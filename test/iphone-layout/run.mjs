#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = process.env.KFM_SHOT_DIR || '/tmp/kfm-iphone-shots';
const ART = process.env.KFM_ARTIFACT_DIR || '/opt/cursor/artifacts';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

const DEVICES = [
  { name: 'se', label: 'iPhone SE', w: 375, h: 667, dpr: 2, ua: 'iPhone' },
  { name: 'mini', label: 'iPhone 13 mini', w: 375, h: 812, dpr: 3, ua: 'iPhone' },
  { name: 'iphone16', label: 'iPhone 16', w: 390, h: 844, dpr: 3, ua: 'iPhone' },
  { name: 'iphone16-393', label: 'iPhone 16 393', w: 393, h: 852, dpr: 3, ua: 'iPhone' },
  { name: 'plus', label: 'iPhone 16 Plus', w: 430, h: 932, dpr: 3, ua: 'iPhone' },
  { name: 'promax15', label: 'iPhone 15 Pro Max', w: 430, h: 932, dpr: 3, ua: 'iPhone' },
  { name: 'promax16', label: 'iPhone 16 Pro Max', w: 440, h: 956, dpr: 3, ua: 'iPhone' },
  { name: 'pro16', label: 'iPhone 16 Pro', w: 402, h: 874, dpr: 3, ua: 'iPhone' },
];

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.md': 'text/plain; charset=utf-8' };

function startServer() {
  return new Promise((resolve) => {
    const srv = createServer(async (req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      let p = decodeURIComponent(url.pathname);
      if (p === '/') p = '/test/iphone-layout/mock.html';
      const file = join(ROOT, p.replace(/^\/+/, ''));
      if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
      try {
        const body = await readFile(file);
        res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
        res.end(body);
      } catch (e) {
        res.writeHead(404); res.end('not found ' + p);
      }
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

async function measure(page) {
  return page.evaluate(() => {
    const H = document.documentElement;
    const W = window.innerWidth;
    const overflow = H.scrollWidth - W;
    const vp = (document.querySelector('meta[name=viewport]') || {}).content || '';
    const box = (sel) => {
      const e = document.querySelector(sel);
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom) };
    };
    const wide = [];
    for (const e of document.body.getElementsByTagName('*')) {
      const r = e.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      if (r.right > W + 2 || r.left < -2) wide.push({ sel: e.id ? '#' + e.id : e.className, w: Math.round(r.width), r: Math.round(r.right) });
      if (wide.length > 12) break;
    }
    const header = document.querySelector('#filter-row--matrix-SALES .filter-row--label-extended');
    const hcs = header ? getComputedStyle(header) : null;
    const checks = [...document.querySelectorAll('#filter-row--matrix-SALES input[type=checkbox]')].map(cb => {
      const wrap = cb.closest('.filter--checkbox, .panelCheck') || cb.parentElement;
      const r = wrap.getBoundingClientRect();
      return {
        lab: (wrap.querySelector('label')?.textContent || '').trim(),
        x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
      };
    });
    return {
      inner: W,
      innerH: window.innerHeight,
      scrollWidth: H.scrollWidth,
      overflow,
      kfm: document.documentElement.classList.contains('kfm'),
      finder: document.documentElement.classList.contains('kfm-finder'),
      vp,
      pager: box('#kfm-pager'),
      list: box('#kfm-list'),
      card: box('#kfm-list .kfm-c'),
      bar: box('.kfm-bottombar'),
      contentAlign: box('#contentAlign'),
      filterInput: box('.filter-input'),
      headerDisplay: hcs && hcs.display,
      headerDir: hcs && hcs.flexDirection,
      checks,
      tog: !!document.getElementById('kfm-bb-tog'),
      togParent: (() => {
        const t = document.getElementById('kfm-bb-tog');
        return t && t.parentElement ? t.parentElement.tagName : '';
      })(),
      togPos: (() => {
        const t = document.getElementById('kfm-bb-tog');
        return t ? getComputedStyle(t).position : '';
      })(),
      togVis: (() => {
        const t = document.getElementById('kfm-bb-tog');
        if (!t) return false;
        const r = t.getBoundingClientRect();
        const cs = getComputedStyle(t);
        return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 8 && r.height > 8
          && r.bottom > 0 && r.top < window.innerHeight;
      })(),
      dbg: !!document.getElementById('kfm-ver-dbg'),
      bbMin: document.documentElement.classList.contains('kfm-bb-min'),
      bbh: document.documentElement.style.getPropertyValue('--kfm-bbh'),
      cookie: document.cookie,
      wide,
    };
  });
}

function ok(m, d, landscape, view) {
  const fail = [];
  if (!m.kfm) fail.push('html.kfm missing');
  if (!landscape && !m.finder) fail.push('html.kfm-finder missing');
  if (m.overflow > 2) fail.push('horizontal overflow ' + m.overflow + ' (scrollWidth=' + m.scrollWidth + ')');
  if (!/viewport-fit=cover/.test(m.vp || '')) fail.push('viewport-fit=cover missing: ' + m.vp);
  if (m.list && Math.abs(m.list.w - m.inner) > 8 && m.list.w + 16 < m.inner) fail.push('list narrower than viewport: ' + m.list.w + ' vs ' + m.inner);
  if (m.card && m.list && m.card.w + 24 < m.list.w) fail.push('card narrower than list: ' + m.card.w + ' vs ' + m.list.w);
  if (m.bar && m.bar.w + 4 < m.inner) fail.push('bottombar narrower than viewport: ' + m.bar.w + ' vs ' + m.inner);
  if (m.pager && (m.pager.l < -1 || m.pager.r > m.inner + 1)) fail.push('pager overflows: ' + JSON.stringify(m.pager));
  if (m.filterInput && m.filterInput.w > m.inner + 1) fail.push('filter-input still ' + m.filterInput.w + 'px');
  if (m.contentAlign && m.contentAlign.w > m.inner + 1) fail.push('contentAlign wider than viewport: ' + m.contentAlign.w);
  if (view === 'filter' || view === 'salesheader') {
    if (!m.checks || m.checks.length < 3) fail.push('sales-header checkboxes missing: ' + JSON.stringify(m.checks));
    else {
      const ys = m.checks.map(c => c.y);
      const xs = m.checks.map(c => c.x);
      for (let i = 1; i < ys.length; i++) {
        if (ys[i] < ys[i - 1] + 20) fail.push('header checkboxes not stacked (y=' + ys.join(',') + ')');
        if (Math.abs(xs[i] - xs[0]) > 8) fail.push('header checkboxes not left-aligned (x=' + xs.join(',') + ')');
      }
    }
    if (!m.tog) fail.push('collapse toggle #kfm-bb-tog missing');
    else if (!m.togVis) fail.push('collapse toggle not visible');
    if (m.tog && m.togParent !== 'BODY') fail.push('toggle not on body: ' + m.togParent);
    if (m.tog && m.togPos !== 'fixed') fail.push('toggle not position:fixed: ' + m.togPos);
    if (m.bar && m.bar.l > 2) fail.push('bottombar inset from left: ' + m.bar.l);
  }
  return fail;
}

async function runDevice(browser, base, d, view, landscape) {
  const w = landscape ? d.h : d.w;
  const h = landscape ? d.w : d.h;
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    deviceScaleFactor: d.dpr,
    isMobile: true,
    hasTouch: true,
    userAgent: `Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1`,
    screen: { width: w, height: h },
  });
  const page = await ctx.newPage();
  const q = (view === 'filter' || view === 'salesheader') ? '?view=' + view : '';
  await page.goto(base + '/test/iphone-layout/mock.html' + q + '#!finder', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  const m = await measure(page);
  const fails = ok(m, d, landscape, view);
  const tag = d.name + (landscape ? '-land' : '') + (view === 'filter' ? '-filter' : '');
  const shot = join(OUT, tag + '.png');
  await page.screenshot({ path: shot, fullPage: false });
  await ctx.close();
  return { tag, label: d.label, w, h, landscape, view, m, fails, shot };
}

async function runCollapse(browser, base, d) {
  const ctx = await browser.newContext({
    viewport: { width: d.w, height: d.h },
    deviceScaleFactor: d.dpr,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    screen: { width: d.w, height: d.h },
  });
  const page = await ctx.newPage();
  const url = base + '/test/iphone-layout/mock.html?view=filter#!finder';
  const fails = [];
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  let m = await measure(page);
  if (!m.tog || !m.togVis) fails.push('toggle missing/hidden before click');
  if (m.bbMin) fails.push('started collapsed');
  const expShot = join(OUT, d.name + '-bb-expanded.png');
  await page.screenshot({ path: expShot, fullPage: false });
  const hExp = parseFloat(m.bbh) || (m.bar && m.bar.h) || 0;
  await page.click('#kfm-bb-tog');
  await page.waitForTimeout(400);
  m = await measure(page);
  if (!m.bbMin) fails.push('did not collapse after click');
  if (!/kfmBbMin=1/.test(m.cookie || '')) fails.push('cookie not set: ' + m.cookie);
  const hMin = parseFloat(m.bbh) || (m.bar && m.bar.h) || 0;
  if (hExp && hMin && hMin >= hExp - 4) fails.push('collapsed height not smaller: ' + hMin + ' vs ' + hExp);
  const minShot = join(OUT, d.name + '-bb-collapsed.png');
  await page.screenshot({ path: minShot, fullPage: false });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  m = await measure(page);
  if (!m.bbMin) fails.push('collapse did not persist after reload');
  if (!m.tog || !m.togVis) fails.push('toggle missing after reload');
  await page.click('#kfm-bb-tog');
  await page.waitForTimeout(400);
  m = await measure(page);
  if (m.bbMin) fails.push('did not expand after second click');
  if (!/kfmBbMin=0/.test(m.cookie || '')) fails.push('expand cookie not set: ' + m.cookie);
  await ctx.close();
  return { tag: d.name + '-collapse', label: d.label, w: d.w, h: d.h, landscape: false, view: 'collapse', m, fails, shot: minShot, expShot };
}

async function runRobust(browser, base, d) {
  const ctx = await browser.newContext({
    viewport: { width: d.w, height: d.h },
    deviceScaleFactor: d.dpr,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    screen: { width: d.w, height: d.h },
  });
  const page = await ctx.newPage();
  const url = base + '/test/iphone-layout/mock.html?view=filter#!finder';
  const fails = [];
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);

  await page.evaluate(() => {
    const bar = document.querySelector('.kfm-bottombar, .filter-actions');
    if (bar) {
      bar.style.setProperty('overflow', 'hidden', 'important');
      bar.style.setProperty('overflow-x', 'hidden', 'important');
      bar.style.setProperty('overflow-y', 'hidden', 'important');
    }
  });
  await page.waitForTimeout(200);
  let m = await measure(page);
  if (!m.tog || !m.togVis) fails.push('toggle hidden when bar overflow:hidden');
  if (m.togParent !== 'BODY') fails.push('toggle not on body after overflow: ' + m.togParent);

  await page.evaluate(() => {
    const t = document.getElementById('kfm-bb-tog');
    if (t) t.remove();
    const bar = document.querySelector('.filter-actions');
    if (bar) {
      const html = bar.innerHTML;
      bar.className = 'filter-actions';
      bar.innerHTML = html;
    }
  });
  await page.waitForTimeout(700);
  m = await measure(page);
  if (!m.tog || !m.togVis) fails.push('toggle not restored after Keepa-like wipe');
  if (m.togParent !== 'BODY') fails.push('restored toggle not on body: ' + m.togParent);
  if (!m.bar) fails.push('kfm-bottombar class not restored after wipe');

  await page.evaluate(() => document.documentElement.classList.remove('kfm-finder'));
  await page.waitForTimeout(100);
  m = await measure(page);
  if (!m.tog || !m.togVis) fails.push('toggle hidden without html.kfm-finder');

  await page.evaluate(() => {
    const v = document.getElementById('kfm-ver');
    if (v) v.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(150);
  m = await measure(page);
  if (!m.dbg) fails.push('version long-press/contextmenu debug overlay missing');
  const dbgText = await page.evaluate(() => (document.getElementById('kfm-ver-dbg') || {}).textContent || '');
  if (!/toggle=/.test(dbgText) || !/kfm-bottombar=/.test(dbgText)) fails.push('debug overlay missing panel/toggle info');

  const shot = join(OUT, d.name + '-bb-robust.png');
  await page.screenshot({ path: shot, fullPage: false });
  await ctx.close();
  return { tag: d.name + '-robust', label: d.label, w: d.w, h: d.h, landscape: false, view: 'robust', m, fails, shot };
}

async function main() {
  await mkdir(OUT, { recursive: true });
  await mkdir(ART, { recursive: true });
  const srv = await startServer();
  const port = srv.address().port;
  const base = 'http://127.0.0.1:' + port;
  let browser;
  try {
    browser = await webkit.launch();
  } catch (e) {
    console.warn('webkit launch failed, falling back to chromium:', e.message);
    browser = await chromium.launch();
  }
  const results = [];
  for (const d of DEVICES) {
    results.push(await runDevice(browser, base, d, 'results', false));
    if (d.name === 'promax16' || d.name === 'se' || d.name === 'iphone16') {
      results.push(await runDevice(browser, base, d, 'filter', false));
      results.push(await runCollapse(browser, base, d));
      results.push(await runRobust(browser, base, d));
      if (d.name !== 'iphone16') results.push(await runDevice(browser, base, d, 'results', true));
    }
  }
  await browser.close();
  srv.close();

  const { copyFile } = await import('node:fs/promises');
  const publish = ['se', 'iphone16', 'promax16'];
  for (const r of results) {
    if (publish.includes(r.tag)) {
      await copyFile(r.shot, join(ART, 'iphone_' + r.tag + '_results.png'));
    }
  }
  // extra named copies for the required artifacts
  const map = {
    se: 'iphone_se.png',
    iphone16: 'iphone_16.png',
    promax16: 'iphone_16_pro_max.png',
    'promax16-land': 'iphone_16_pro_max_landscape.png',
    'se-filter': 'iphone_se_filters.png',
    'iphone16-filter': 'iphone_16_filters.png',
    'promax16-filter': 'iphone_16_pro_max_filters.png',
  };
  for (const r of results) {
    if (r.tag === 'promax16-collapse') {
      if (r.expShot) await copyFile(r.expShot, join(ART, 'iphone_16_pro_max_panel_expanded.png'));
      await copyFile(r.shot, join(ART, 'iphone_16_pro_max_panel_collapsed.png'));
    }
    if (r.tag === 'se-collapse') {
      if (r.expShot) await copyFile(r.expShot, join(ART, 'iphone_se_panel_expanded.png'));
      await copyFile(r.shot, join(ART, 'iphone_se_panel_collapsed.png'));
    }
    if (r.tag === 'iphone16-collapse') {
      if (r.expShot) await copyFile(r.expShot, join(ART, 'iphone_16_panel_expanded.png'));
      await copyFile(r.shot, join(ART, 'iphone_16_panel_collapsed.png'));
    }
  }
  for (const r of results) {
    if (map[r.tag]) await copyFile(r.shot, join(ART, map[r.tag]));
  }

  let failed = 0;
  for (const r of results) {
    const status = r.fails.length ? 'FAIL' : 'ok';
    if (r.fails.length) failed++;
    console.log(`${status} ${r.tag} ${r.w}x${r.h} overflow=${r.m.overflow} kfm=${r.m.kfm} list=${r.m.list && r.m.list.w} pager=${r.m.pager && r.m.pager.w} bar=${r.m.bar && r.m.bar.w}`);
    if (r.fails.length) console.log('   ' + r.fails.join('; '));
  }
  if (failed) {
    console.error(failed + ' device(s) failed');
    process.exit(1);
  }
  console.log('all devices passed, shots in', OUT);
}

main().catch((e) => { console.error(e); process.exit(1); });
