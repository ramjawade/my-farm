#!/usr/bin/env node
/**
 * Brand assets (OpenSpec change: brand-logo).
 *
 *   node scripts/build-brand-assets.mjs           regenerate every size
 *   node scripts/build-brand-assets.mjs --check   verify the manifest's icons exist at their stated size
 *
 * Inputs : design/logo/myfarm-logo-master.webp (the approved emblem)
 *          projects/home/public/brand/mark.svg (the hand-drawn small mark)
 * Outputs: public/brand/logo-{96,192,512}.webp   emblem, transparent, for the UI
 *          public/icons/icon-*.png                emblem on a white disc, transparent corners (purpose: any)
 *          public/icons/maskable-{192,512}.png    emblem at 72% on a solid background (purpose: maskable)
 *          public/apple-touch-icon.png            180 px, opaque
 *          public/favicon.svg, public/favicon.ico (16/32/48 from the mark)
 *
 * Rasterising uses Playwright's Chromium (already a dev dependency), so no
 * image library is needed.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PUBLIC = join(ROOT, 'projects/home/public');
const MASTER = join(ROOT, 'design/logo/myfarm-logo-master.webp');
const MARK = join(PUBLIC, 'brand/mark.svg');
const MANIFEST = join(PUBLIC, 'manifest.webmanifest');

/** Solid background behind maskable and Apple icons (the light page background). */
const ICON_BACKGROUND = '#eef1ec';
const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const UI_SIZES = [96, 192, 512];
const MASKABLE_SIZES = [192, 512];
const MASKABLE_SCALE = 0.72;
const APPLE_SIZE = 180;
const APPLE_SCALE = 0.8;
const FAVICON_SIZES = [16, 32, 48];

const rel = (file) => relative(ROOT, file).split('\\').join('/');

function write(file, data) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, data);
  console.log('  wrote', rel(file));
}

// ---- image header readers (check mode, no image library) -------------------

function pngSize(buf) {
  const signature = '89504e470d0a1a0a';
  if (buf.length < 24 || buf.subarray(0, 8).toString('hex') !== signature) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function webpSize(buf) {
  if (
    buf.length < 30 ||
    buf.toString('ascii', 0, 4) !== 'RIFF' ||
    buf.toString('ascii', 8, 12) !== 'WEBP'
  ) {
    return null;
  }
  const kind = buf.toString('ascii', 12, 16);
  if (kind === 'VP8X') {
    return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
  }
  if (kind === 'VP8L') {
    const bits = buf.readUInt32LE(21);
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
  }
  if (kind === 'VP8 ') {
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  }
  return null;
}

function icoSizes(buf) {
  if (buf.length < 6 || buf.readUInt16LE(0) !== 0 || buf.readUInt16LE(2) !== 1) return null;
  const count = buf.readUInt16LE(4);
  const sizes = [];
  for (let i = 0; i < count; i++) {
    const w = buf[6 + i * 16] || 256;
    sizes.push(w);
  }
  return sizes;
}

function check() {
  const problems = [];
  const need = (file) => {
    if (!existsSync(file)) {
      problems.push(`missing ${rel(file)}`);
      return null;
    }
    return readFileSync(file);
  };

  const manifest = JSON.parse(need(MANIFEST)?.toString('utf8') ?? '{"icons":[]}');
  if (!manifest.icons?.length) problems.push('manifest.webmanifest lists no icons');
  const purposes = new Set();
  for (const icon of manifest.icons ?? []) {
    const buf = need(join(PUBLIC, icon.src));
    if (!buf) continue;
    const size = pngSize(buf);
    const [w, h] = String(icon.sizes).split('x').map(Number);
    if (!size) problems.push(`${icon.src} is not a PNG`);
    else if (size.width !== w || size.height !== h) {
      problems.push(
        `${icon.src} is ${size.width}x${size.height} but the manifest says ${icon.sizes}`,
      );
    }
    purposes.add(icon.purpose ?? 'any');
  }
  for (const purpose of ['any', 'maskable']) {
    if (manifest.icons?.length && !purposes.has(purpose)) {
      problems.push(`manifest has no icon with purpose "${purpose}"`);
    }
  }

  const apple = need(join(PUBLIC, 'apple-touch-icon.png'));
  if (apple) {
    const size = pngSize(apple);
    if (!size || size.width !== APPLE_SIZE || size.height !== APPLE_SIZE) {
      problems.push(`apple-touch-icon.png must be ${APPLE_SIZE}x${APPLE_SIZE}`);
    }
  }
  need(join(PUBLIC, 'favicon.svg'));
  need(MARK);
  const ico = need(join(PUBLIC, 'favicon.ico'));
  if (ico) {
    const sizes = icoSizes(ico);
    if (!sizes || FAVICON_SIZES.some((s) => !sizes.includes(s))) {
      problems.push(`favicon.ico must contain ${FAVICON_SIZES.join(', ')} px images`);
    }
  }
  for (const s of UI_SIZES) {
    const buf = need(join(PUBLIC, `brand/logo-${s}.webp`));
    const size = buf && webpSize(buf);
    if (buf && (!size || size.width !== s || size.height !== s)) {
      problems.push(`brand/logo-${s}.webp must be ${s}x${s}`);
    }
  }

  if (problems.length) {
    problems.forEach((p) => console.error('brand:check  ' + p));
    console.error(`\n${problems.length} brand asset problem(s). Run "npm run brand:build".`);
    process.exit(1);
  }
  console.log('brand:check: all brand assets are present at their stated sizes.');
}

// ---- build -----------------------------------------------------------------

function buildIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const entries = Buffer.alloc(16 * pngs.length);
  let offset = 6 + entries.length;
  pngs.forEach(({ size, data }, i) => {
    const at = i * 16;
    entries[at] = size === 256 ? 0 : size;
    entries[at + 1] = size === 256 ? 0 : size;
    entries.writeUInt16LE(1, at + 4); // colour planes
    entries.writeUInt16LE(32, at + 6); // bits per pixel
    entries.writeUInt32LE(data.length, at + 8);
    entries.writeUInt32LE(offset, at + 12);
    offset += data.length;
  });
  return Buffer.concat([header, entries, ...pngs.map((p) => p.data)]);
}

async function build() {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent('<canvas id="c"></canvas>');

  // Load the master once, trimmed to its visible bounds.
  const masterUrl = 'data:image/webp;base64,' + readFileSync(MASTER).toString('base64');
  await page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const probe = document.createElement('canvas');
    probe.width = img.naturalWidth;
    probe.height = img.naturalHeight;
    const pctx = probe.getContext('2d');
    pctx.drawImage(img, 0, 0);
    const { data, width, height } = pctx.getImageData(0, 0, probe.width, probe.height);
    let minX = width,
      minY = height,
      maxX = 0,
      maxY = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3] > 8) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    const side = Math.max(w, h);
    // Square canvas with the emblem centred.
    const sq = document.createElement('canvas');
    sq.width = side;
    sq.height = side;
    sq.getContext('2d').drawImage(img, minX, minY, w, h, (side - w) / 2, (side - h) / 2, w, h);
    window.__emblem = sq;
  }, masterUrl);

  /**
   * Draws the emblem into a size x size canvas. `scale` is the emblem's share
   * of the canvas, `disc` puts a white disc behind it (so the transparent sky
   * is white, as in the UI), `background` fills the whole canvas first.
   * Downscales in halving steps for sharper results.
   */
  const render = (size, { scale = 1, disc = false, background = null, format = 'png' } = {}) =>
    page
      .evaluate(
        ({ size, scale, disc, background, format }) => {
          const src = window.__emblem;
          const target = Math.round(size * scale);
          let current = src;
          while (current.width / 2 >= target) {
            const half = document.createElement('canvas');
            half.width = Math.round(current.width / 2);
            half.height = half.width;
            const hctx = half.getContext('2d');
            hctx.imageSmoothingQuality = 'high';
            hctx.drawImage(current, 0, 0, half.width, half.height);
            current = half;
          }
          const out = document.createElement('canvas');
          out.width = size;
          out.height = size;
          const ctx = out.getContext('2d');
          ctx.imageSmoothingQuality = 'high';
          if (background) {
            ctx.fillStyle = background;
            ctx.fillRect(0, 0, size, size);
          }
          const offset = (size - target) / 2;
          if (disc) {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(size / 2, size / 2, (target / 2) * 0.985, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.drawImage(current, offset, offset, target, target);
          const mime = format === 'webp' ? 'image/webp' : 'image/png';
          return out.toDataURL(mime, 0.92).split(',')[1];
        },
        { size, scale, disc, background, format },
      )
      .then((b64) => Buffer.from(b64, 'base64'));

  console.log('Emblem sizes for the UI');
  for (const s of UI_SIZES)
    write(join(PUBLIC, `brand/logo-${s}.webp`), await render(s, { format: 'webp' }));

  console.log('Installed-app icons');
  for (const s of ICON_SIZES)
    write(join(PUBLIC, `icons/icon-${s}.png`), await render(s, { disc: true }));
  for (const s of MASKABLE_SIZES) {
    write(
      join(PUBLIC, `icons/maskable-${s}.png`),
      await render(s, { scale: MASKABLE_SCALE, disc: true, background: ICON_BACKGROUND }),
    );
  }
  write(
    join(PUBLIC, 'apple-touch-icon.png'),
    await render(APPLE_SIZE, { scale: APPLE_SCALE, disc: true, background: ICON_BACKGROUND }),
  );

  console.log('Favicon');
  const markSvg = readFileSync(MARK, 'utf8');
  write(join(PUBLIC, 'favicon.svg'), markSvg);
  const pngs = [];
  for (const size of FAVICON_SIZES) {
    const shot = await browser.newPage({ viewport: { width: size, height: size } });
    await shot.setContent(
      `<body style="margin:0;background:transparent"><img src="data:image/svg+xml;base64,${Buffer.from(markSvg).toString('base64')}" width="${size}" height="${size}" style="display:block"></body>`,
    );
    await shot.waitForFunction(() => document.images[0].complete);
    pngs.push({ size, data: await shot.screenshot({ omitBackground: true }) });
    await shot.close();
  }
  write(join(PUBLIC, 'favicon.ico'), buildIco(pngs));

  await browser.close();
}

if (process.argv.includes('--check')) {
  check();
} else {
  await build();
  check();
}
