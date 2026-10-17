import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildFeedUrl,
  chunk,
  fetchAllRecords,
  main,
  redact,
  withRetry,
} from './fetch-mandi-prices.mjs';

const ok = (body) => ({ ok: true, status: 200, json: async () => body });
const record = (n) => ({ state: 'Maharashtra', market: `M${n}`, commodity: 'Onion' });
const noWait = { tries: 3, delayMs: 0, sleep: async () => {} };

test('buildFeedUrl sends the key, paging and exact filters', () => {
  const url = buildFeedUrl({ apiKey: 'K', state: 'Maharashtra', commodity: 'Bajra(Pearl Millet/Cumbu)', offset: 200, limit: 100 });
  assert.equal(url.searchParams.get('api-key'), 'K');
  assert.equal(url.searchParams.get('format'), 'json');
  assert.equal(url.searchParams.get('offset'), '200');
  assert.equal(url.searchParams.get('limit'), '100');
  assert.equal(url.searchParams.get('filters[state.keyword]'), 'Maharashtra');
  assert.equal(url.searchParams.get('filters[commodity]'), 'Bajra(Pearl Millet/Cumbu)');
});

test('redact hides every secret and ignores empty ones', () => {
  assert.equal(redact('GET /x?api-key=SECRET1 token=T2', ['SECRET1', 'T2', '']), 'GET /x?api-key=*** token=***');
});

test('chunk splits in order', () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunk([], 2), []);
});

test('withRetry retries then succeeds, and throws the last error when it never does', async () => {
  let calls = 0;
  const value = await withRetry(async () => {
    calls += 1;
    if (calls < 3) throw new Error('boom');
    return 'done';
  }, noWait);
  assert.equal(value, 'done');
  await assert.rejects(withRetry(async () => { throw new Error('always'); }, noWait), /always/);
});

test('fetchAllRecords pages until the total is reached', async () => {
  const offsets = [];
  const fetchFn = async (url) => {
    const offset = Number(url.searchParams.get('offset'));
    offsets.push(offset);
    return ok({ total: 5, records: [record(offset), record(offset + 1)].slice(0, Math.min(2, 5 - offset)) });
  };
  const records = await fetchAllRecords({ fetchFn, apiKey: 'K', state: 'Maharashtra', commodity: 'Onion', limit: 2, retry: noWait });
  assert.equal(records.length, 5);
  assert.deepEqual(offsets, [0, 2, 4]);
});

test('fetchAllRecords stops on an empty page', async () => {
  const fetchFn = async () => ok({ total: 99, records: [] });
  const records = await fetchAllRecords({ fetchFn, apiKey: 'K', state: 'S', commodity: 'C', limit: 100, retry: noWait });
  assert.deepEqual(records, []);
});

test('feed errors mention the status or cause but never the key', async () => {
  const status = async () => ({ ok: false, status: 403, json: async () => ({}) });
  await assert.rejects(
    fetchAllRecords({ fetchFn: status, apiKey: 'SECRETKEY', state: 'S', commodity: 'Onion', limit: 1, retry: noWait }),
    (error) => /HTTP 403/.test(error.message) && !error.message.includes('SECRETKEY'),
  );
  const refused = async (url) => {
    const error = new Error(`fetch failed ${url}`);
    error.cause = { code: 'ECONNREFUSED' };
    throw error;
  };
  await assert.rejects(
    fetchAllRecords({ fetchFn: refused, apiKey: 'SECRETKEY', state: 'S', commodity: 'Onion', limit: 1, retry: noWait }),
    (error) => /ECONNREFUSED/.test(error.message) && !error.message.includes('SECRETKEY'),
  );
});

function fakeWorld({ commodities, rowsByCommodity }) {
  const posts = [];
  const fetchFn = async (input, init) => {
    const url = String(input);
    if (url.endsWith('/admin/prices/commodities')) return ok({ commodities });
    if (url.endsWith('/admin/prices/rows')) {
      const rows = JSON.parse(init.body).rows;
      posts.push({ headers: init.headers, rows });
      return ok({ received: rows.length, stored: rows.length, ignored: 0, skipped: 0, mandis_added: 1 });
    }
    const commodity = new URL(url).searchParams.get('filters[commodity]');
    const rows = rowsByCommodity[commodity] ?? [];
    return ok({ total: rows.length, records: rows });
  };
  return { fetchFn, posts };
}

const env = { ADMIN_TOKEN: 'T', MANDI_API_KEY: 'K', API_BASE: 'https://api.example/', RETRY_DELAY_MS: '0' };

test('main fetches each commodity, posts in batches with the admin token and sums the counts', async () => {
  const many = Array.from({ length: 2500 }, (_, i) => record(i));
  const { fetchFn, posts } = fakeWorld({ commodities: ['Onion', 'Wheat'], rowsByCommodity: { Onion: many, Wheat: [record(1)] } });
  const logs = [];
  const result = await main(env, fetchFn, (line) => logs.push(line));

  assert.equal(result.fetched, 2501);
  assert.deepEqual(posts.map((p) => p.rows.length), [1000, 1000, 500, 1]);
  assert.equal(posts[0].headers['X-Admin-Token'], 'T');
  assert.equal(result.totals.stored, 2501);
  assert.ok(logs.some((l) => l.startsWith('Stored:')));
  assert.ok(!logs.join('\n').includes('"K"'));
});

test('main warns about a commodity with no rows but still succeeds', async () => {
  const { fetchFn } = fakeWorld({ commodities: ['Onion', 'Misspelt'], rowsByCommodity: { Onion: [record(1)] } });
  const logs = [];
  const result = await main(env, fetchFn, (line) => logs.push(line));
  assert.deepEqual(result.empty, ['Misspelt']);
  assert.ok(logs.some((l) => l.includes('WARNING') && l.includes('Misspelt')));
});

test('main fails when the feed returns nothing at all', async () => {
  const { fetchFn } = fakeWorld({ commodities: ['Onion'], rowsByCommodity: {} });
  await assert.rejects(main(env, fetchFn, () => {}), /no rows for any commodity/);
});

test('a dry run posts nothing', async () => {
  const { fetchFn, posts } = fakeWorld({ commodities: ['Onion'], rowsByCommodity: { Onion: [record(1)] } });
  const result = await main({ ...env, DRY_RUN: '1' }, fetchFn, () => {});
  assert.equal(result.fetched, 1);
  assert.equal(posts.length, 0);
});

test('main refuses to start without its secrets', async () => {
  await assert.rejects(main({ MANDI_API_KEY: 'K' }, async () => ok({}), () => {}), /ADMIN_TOKEN/);
  await assert.rejects(main({ ADMIN_TOKEN: 'T' }, async () => ok({}), () => {}), /MANDI_API_KEY/);
});
