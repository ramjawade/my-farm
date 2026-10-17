#!/usr/bin/env node
/**
 * Fetches mandi prices from the data.gov.in feed and posts them to the MyFarm backend.
 *
 * The feed only accepts connections from Indian IPs (Render and GitHub's US runners are
 * refused), so this runs on a self-hosted runner in India (see price-ingest.yml). The
 * backend never calls the feed; it only stores the rows it is sent.
 *
 *   ADMIN_TOKEN=... MANDI_API_KEY=... node scripts/fetch-mandi-prices.mjs
 *
 * Environment:
 *   ADMIN_TOKEN     required  the backend's admin token (X-Admin-Token)
 *   MANDI_API_KEY   required  the free data.gov.in key
 *   API_BASE        optional  default https://myfarm-api.onrender.com
 *   MANDI_STATE     optional  default Maharashtra
 *   PAGE_LIMIT      optional  records per feed request, default 100
 *   DRY_RUN         optional  "1" fetches and reports but posts nothing
 *
 * The key is never printed: every message passes through `redact`.
 */

import { pathToFileURL } from 'node:url';

export const FEED_URL = 'https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070';
export const POST_BATCH = 1000;

export function redact(text, secrets) {
  let out = String(text);
  for (const secret of secrets) {
    if (secret) out = out.split(secret).join('***');
  }
  return out;
}

export function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function buildFeedUrl({ base = FEED_URL, apiKey, state, commodity, offset, limit }) {
  const url = new URL(base);
  url.searchParams.set('api-key', apiKey);
  url.searchParams.set('format', 'json');
  url.searchParams.set('offset', String(offset));
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('filters[state.keyword]', state);
  url.searchParams.set('filters[commodity]', commodity);
  return url;
}

/** Runs `fn` up to `tries` times, waiting `delayMs` between attempts. */
export async function withRetry(fn, { tries = 3, delayMs = 10_000, sleep = defaultSleep } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      if (attempt < tries) await sleep(delayMs);
    }
  }
  throw lastError;
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function describe(error, secrets) {
  const code = error?.cause?.code ? ` (${error.cause.code})` : '';
  return redact(`${error?.message ?? error}${code}`, secrets);
}

/** Every record the feed has for one commodity, paging with offset and limit. */
export async function fetchAllRecords({ fetchFn, apiKey, state, commodity, limit, retry }) {
  const records = [];
  let offset = 0;
  for (;;) {
    const url = buildFeedUrl({ apiKey, state, commodity, offset, limit });
    const body = await withRetry(async () => {
      let response;
      try {
        response = await fetchFn(url);
      } catch (error) {
        throw new Error(`feed request failed for ${commodity}: ${describe(error, [apiKey])}`);
      }
      if (!response.ok) {
        throw new Error(`feed request failed for ${commodity}: HTTP ${response.status}`);
      }
      return response.json();
    }, retry);

    if (!Array.isArray(body?.records)) {
      throw new Error(`feed reply for ${commodity} has no records list`);
    }
    records.push(...body.records);
    offset += body.records.length;
    const total = Number(body.total);
    if (body.records.length === 0 || !Number.isFinite(total) || offset >= total) break;
  }
  return records;
}

/** Says whether the feed answers from this machine. Never throws: it is only a diagnostic. */
export async function checkFeedReachable(fetchFn, log) {
  try {
    const response = await fetchFn(`${FEED_URL}?format=json&limit=1`);
    // A reply, even HTTP 400 "Authorization field missing", means the connection works.
    log(`Feed reachable from this machine: HTTP ${response.status}`);
  } catch (error) {
    const code = error?.cause?.code ?? error?.message ?? 'unknown error';
    log(`Feed NOT reachable from this machine (${code}). It only accepts Indian IPs.`);
  }
}

async function backend({ fetchFn, base, token, path, method = 'GET', body, retry }) {
  return withRetry(async () => {
    let response;
    try {
      response = await fetchFn(`${base}${path}`, {
        method,
        headers: { 'X-Admin-Token': token, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      throw new Error(`backend ${method} ${path} failed: ${describe(error, [token])}`);
    }
    if (!response.ok) {
      throw new Error(`backend ${method} ${path} failed: HTTP ${response.status}`);
    }
    return response.json();
  }, retry);
}

export async function main(env = process.env, fetchFn = fetch, log = console.log) {
  const token = env.ADMIN_TOKEN;
  const apiKey = env.MANDI_API_KEY;
  if (!token) throw new Error('ADMIN_TOKEN is not set');
  if (!apiKey) throw new Error('MANDI_API_KEY is not set');
  const base = (env.API_BASE ?? 'https://myfarm-api.onrender.com').replace(/\/$/, '');
  const state = env.MANDI_STATE ?? 'Maharashtra';
  const limit = Number(env.PAGE_LIMIT ?? 100);
  const dryRun = env.DRY_RUN === '1';
  // Render's free instance sleeps; its first answer can take a minute.
  const backendRetry = { tries: 5, delayMs: env.RETRY_DELAY_MS ? Number(env.RETRY_DELAY_MS) : 30_000 };
  const feedRetry = { tries: 3, delayMs: env.RETRY_DELAY_MS ? Number(env.RETRY_DELAY_MS) : 10_000 };

  await checkFeedReachable(fetchFn, log);
  const { commodities } = await backend({
    fetchFn, base, token, path: '/api/v1/admin/prices/commodities', retry: backendRetry,
  });
  log(`Fetching ${commodities.length} commodities for ${state}${dryRun ? ' (dry run)' : ''}`);

  const totals = { received: 0, stored: 0, ignored: 0, skipped: 0, mandis_added: 0 };
  const empty = [];
  let fetched = 0;
  for (const commodity of commodities) {
    const records = await fetchAllRecords({
      fetchFn, apiKey, state, commodity, limit, retry: feedRetry,
    });
    fetched += records.length;
    log(`  ${commodity}: ${records.length} rows`);
    if (records.length === 0) empty.push(commodity);
    if (dryRun) continue;
    for (const rows of chunk(records, POST_BATCH)) {
      const result = await backend({
        fetchFn, base, token, path: '/api/v1/admin/prices/rows', method: 'POST',
        body: { rows }, retry: backendRetry,
      });
      for (const key of Object.keys(totals)) totals[key] += result[key] ?? 0;
    }
  }

  if (empty.length) {
    log(`WARNING: no rows for ${empty.join(', ')}. Check the spelling in crop_catalog.price_commodity.`);
  }
  log(dryRun ? `Fetched ${fetched} rows (nothing posted)` : `Stored: ${JSON.stringify(totals)}`);
  if (fetched === 0 && commodities.length > 0) {
    throw new Error('the feed returned no rows for any commodity');
  }
  return { fetched, totals, empty };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`ERROR: ${error.message}`);
    process.exit(1);
  });
}
