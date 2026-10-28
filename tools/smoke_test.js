// Headless checks of the map shell. Every tile service and the CDN are
// stubbed, so the result never depends on NGU, NVE or Kartverket being up.
//
//   python3 -m http.server 8902 --bind 127.0.0.1      (from the repo root)
//   npm install --no-save maplibre-gl@4.7.1 playwright
//   node tools/smoke_test.js
//
// Screenshots land in outputs/ (ignored by git).

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BASE = process.env.RK_URL || 'http://127.0.0.1:8902/index.html';
const LIB = path.join(ROOT, 'node_modules', 'maplibre-gl', 'dist');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

let failed = 0;
const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) failed++; };

(async () => {
  fs.mkdirSync(path.join(ROOT, 'outputs'), { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });

  for (const [label, w, h] of [['desktop', 1440, 900], ['phone', 390, 844]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|AJAXError/.test(m.text())) errors.push(m.text()); });

    await page.route('**/*', route => {
      const u = route.request().url();
      if (u.startsWith('http://127.0.0.1')) return route.continue();
      if (u.includes('maplibre-gl.js')) return route.fulfill({ path: path.join(LIB, 'maplibre-gl.js'), contentType: 'text/javascript' });
      if (u.includes('maplibre-gl.css')) return route.fulfill({ path: path.join(LIB, 'maplibre-gl.css'), contentType: 'text/css' });
      if (u.includes('fonts.g')) return route.fulfill({ body: '', contentType: 'text/css' });
      if (/GetFeatureInfo/.test(u)) return route.fulfill({ body: '<table><tr><th>navn</th><td>Testravine</td></tr></table>', contentType: 'text/html' });
      return route.fulfill({ body: PNG, contentType: 'image/png' });
    });

    await page.goto(BASE + '?top=48');
    await page.waitForFunction(() => document.querySelectorAll('.switch').length > 0, null, { timeout: 15000 });
    await page.waitForTimeout(1500);

    const n = await page.$$eval('.switch', s => s.length);
    check(n === 10, `${label}: 10 layer switches (9 services + our records), found ${n}`);
    check(await page.$eval('.panel', el => !!el), `${label}: panel present`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    check(!overflow, `${label}: no horizontal scroll`);
    const top = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--frame-top').trim());
    check(top === '48px', `${label}: ?top=48 sets the frame offset (${top})`);

    // On a phone the panel starts as a folded sheet; open it first.
    if (await page.$eval('#sheet-toggle', b => getComputedStyle(b).display !== 'none')) {
      check(await page.$eval('#panel', p => p.classList.contains('collapsed')), `${label}: sheet starts folded`);
      await page.click('#sheet-toggle');
    }
    // Turn a layer on, switch language and background.
    await page.click('.row[data-id="marin-grense"] .switch');
    check(await page.$eval('.row[data-id="marin-grense"] .switch', s => s.getAttribute('aria-checked')) === 'true', `${label}: switch turns a layer on`);
    await page.click('.lang button[data-lang="en"]');
    check(await page.$eval('.panel-head h1 + .lang, h1', () => document.querySelector('[data-t="g_background"]').textContent) === 'Background', `${label}: English labels`);
    await page.click('#basemaps button:nth-child(2)');
    check(await page.$eval('#basemaps button:nth-child(2)', b => b.getAttribute('aria-pressed')) === 'true', `${label}: background switches`);

    // Point query.
    await page.mouse.click(Math.round(w * 0.7), Math.round(h * 0.35));
    await page.waitForTimeout(800);
    check(await page.$eval('#info', el => el.classList.contains('open')), `${label}: click opens point info`);
    const frames = await page.$$eval('.hit iframe', f => f.map(x => x.getAttribute('sandbox')));
    check(frames.length > 0 && frames.every(s => s === ''), `${label}: service answers shown in sandboxed frames (${frames.length})`);

    check(errors.length === 0, `${label}: no script errors${errors.length ? ' — ' + errors.join(' | ') : ''}`);
    await page.screenshot({ path: path.join(ROOT, 'outputs', `smoke_${label}.png`) });
    await page.close();
  }
  await browser.close();
  console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
  process.exit(failed ? 1 : 0);
})();
