#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFile, mkdir, copyFile } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';
import { createMockGas, TEST_KEY } from './mock-gas.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = process.env.KFM_SHOT_DIR || '/tmp/kfm-later-shots';
const ART = process.env.KFM_ARTIFACT_DIR || '/opt/cursor/artifacts';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.md': 'text/plain; charset=utf-8' };

function startStatic() {
  return new Promise(resolve => {
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

async function api(gas, path, opt = {}) {
  const url = gas.url + path;
  const r = await fetch(url, {
    method: opt.method || 'GET',
    headers: opt.headers || (opt.body ? { 'Content-Type': 'text/plain;charset=utf-8' } : {}),
    body: opt.body
  });
  return r.json();
}

async function checkApi(gas) {
  const fail = [];
  const bad = await api(gas, '?key=wrong&action=list');
  if (!bad || bad.error !== 'unauthorized') fail.push('wrong key did not return unauthorized');
  const none = await api(gas, '?action=list');
  if (!none || none.error !== 'unauthorized') fail.push('missing key did not return unauthorized');

  const listed = await api(gas, '?key=' + encodeURIComponent(TEST_KEY) + '&action=list');
  if (!listed.ok || !Array.isArray(listed.items)) fail.push('list failed');
  const asins = (listed.items || []).map(i => i.asin);
  if (!asins.includes('B0TESTASIN') || !asins.includes('B0BOTTLE01')) fail.push('seed items missing: ' + asins.join(','));

  const ex1 = await api(gas, '?key=' + encodeURIComponent(TEST_KEY) + '&action=exists&asin=B0TESTASIN');
  if (!ex1.exists) fail.push('exists seed false');
  const ex2 = await api(gas, '?key=' + encodeURIComponent(TEST_KEY) + '&action=exists&asin=B0CHARGER1');
  if (ex2.exists) fail.push('exists unseen true');

  const dup = await api(gas, '?key=' + encodeURIComponent(TEST_KEY), {
    method: 'POST',
    body: JSON.stringify({ action: 'add', item: { asin: 'B0TESTASIN', title: 'x' }, mode: 'reject' })
  });
  if (!(dup.ok === false && dup.duplicate)) fail.push('duplicate add not rejected');

  const add = await api(gas, '?key=' + encodeURIComponent(TEST_KEY), {
    method: 'POST',
    body: JSON.stringify({ action: 'add', item: { asin: 'B0CHARGER1', title: 'USB-C 急速充電器 65W', price: 2180, breakEven: 1696 }, mode: 'reject' })
  });
  if (!add.ok || add.duplicate) fail.push('add new failed: ' + JSON.stringify(add));

  const del = await api(gas, '?key=' + encodeURIComponent(TEST_KEY), {
    method: 'POST',
    body: JSON.stringify({ action: 'delete', asin: 'B0CHARGER1' })
  });
  if (!del.ok) fail.push('delete failed');
  const gone = await api(gas, '?key=' + encodeURIComponent(TEST_KEY) + '&action=exists&asin=B0CHARGER1');
  if (gone.exists) fail.push('deleted item still exists');

  const last = gas.log.posts[gas.log.posts.length - 1];
  if (!last || !/text\/plain/i.test(last.ctype)) fail.push('POST content-type not text/plain: ' + (last && last.ctype));
  return fail;
}

async function launchBrowser() {
  try { return await webkit.launch(); }
  catch (e) {
    console.warn('webkit launch failed, falling back to chromium:', e.message);
    return chromium.launch();
  }
}

function laterUrl(base, gas, extra) {
  const u = new URL(base + '/test/iphone-layout/mock.html');
  u.searchParams.set('later', '1');
  u.searchParams.set('kfmtest', '1');
  u.searchParams.set('gas', gas.url);
  u.searchParams.set('key', gas.key);
  if (extra) Object.entries(extra).forEach(([k, v]) => u.searchParams.set(k, v));
  u.hash = '!finder';
  return u.toString();
}

async function openLater(browser, base, gas, d, extra) {
  const ctx = await browser.newContext({
    viewport: { width: d.w, height: d.h },
    deviceScaleFactor: d.dpr,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    screen: { width: d.w, height: d.h }
  });
  const page = await ctx.newPage();
  await page.goto(laterUrl(base, gas, extra), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!(window.__kfmTest && document.querySelector('#kfm-list .kfm-c')), { timeout: 8000 });
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    document.querySelectorAll('#kfm-list .kfm-g').forEach(e => e.remove());
    const tog = document.getElementById('kfm-bb-tog');
    if (tog && !document.documentElement.classList.contains('kfm-bb-min')) tog.click();
  });
  await page.waitForTimeout(250);
  await page.waitForFunction(() => {
    const t = window.__kfmTest;
    return t && t.cfg && t.cfg.gasKey && (t.listCache.size > 0 || t.existsCache.size > 0);
  }, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(400);
  return { ctx, page };
}

async function measureLater(page) {
  return page.evaluate(() => {
    const W = window.innerWidth;
    const H = document.documentElement;
    const cards = [...document.querySelectorAll('#kfm-list .kfm-c')].map(c => ({
      asin: c.dataset.asin || '',
      add: !!(c.querySelector('.kfm-later-add')),
      has: !!(c.querySelector('.kfm-later-has')),
      del: !!(c.querySelector('.kfm-later-del')),
      addText: (c.querySelector('.kfm-later-add') || {}).textContent || '',
      hasText: (c.querySelector('.kfm-later-has') || {}).textContent || '',
      delText: (c.querySelector('.kfm-later-del') || {}).textContent || '',
      w: Math.round(c.getBoundingClientRect().width)
    }));
    const sheet = document.getElementById('kfm-sheet');
    const lis = sheet ? [...sheet.querySelectorAll('.kfm-li')].map(r => ({
      title: (r.querySelector('.kfm-li-t') || {}).textContent || '',
      del: !!(r.querySelector('.kfm-li-d')),
      w: Math.round(r.getBoundingClientRect().width)
    })) : [];
    const setUrl = sheet && (sheet.querySelector('.kfm-set input[type=url]') || {}).value;
    const labels = sheet ? [...sheet.querySelectorAll('.kfm-set label')].map(x => x.textContent) : [];
    const toast = (document.getElementById('kfm-toast') || {}).textContent || '';
    const t = window.__kfmTest || {};
    return {
      inner: W,
      overflow: H.scrollWidth - W,
      cards,
      lis,
      sheetTitle: sheet ? ((sheet.querySelector('.kfm-sh-top span') || {}).textContent || '') : '',
      setUrl,
      labels,
      toast,
      transport: t.lastTransport ? { ...t.lastTransport } : null,
      xhr: (window.__kfmXhrCalls || []).map(x => ({ method: x.method, ctype: (x.headers && x.headers['Content-Type']) || '', hasJson: /application\/json/i.test((x.headers && x.headers['Content-Type']) || '') })),
      listed: t.listCache ? [...t.listCache.keys()] : [],
      defaultUrl: t.DEFAULT_GAS_URL || ''
    };
  });
}

async function runUi(browser, base, gas) {
  const fail = [];
  const devices = [
    { name: 'se', label: 'iPhone SE', w: 375, h: 667, dpr: 2 },
    { name: 'promax16', label: 'iPhone 16 Pro Max', w: 440, h: 956, dpr: 3 }
  ];
  const shots = {};

  for (const d of devices) {
    const { ctx, page } = await openLater(browser, base, gas, d);
    let m = await measureLater(page);
    if (m.overflow > 2) fail.push(d.name + ' cards overflow ' + m.overflow);
    if (m.cards.length < 2) fail.push(d.name + ' cards missing: ' + m.cards.length);
    const seeded = m.cards.find(c => c.asin === 'B0TESTASIN');
    const fresh = m.cards.find(c => c.asin === 'B0CHARGER1');
    if (!seeded || !seeded.has || !seeded.del || seeded.add) fail.push(d.name + ' seeded card should show 既にあります+削除: ' + JSON.stringify(seeded));
    if (seeded && seeded.hasText !== '既にあります') fail.push(d.name + ' has label: ' + (seeded && seeded.hasText));
    if (!fresh || !fresh.add || fresh.del) fail.push(d.name + ' new card should show あとで見る only: ' + JSON.stringify(fresh));
    if (fresh && fresh.addText !== 'あとで見る') fail.push(d.name + ' add label: ' + (fresh && fresh.addText));
    await page.evaluate(() => {
      document.querySelectorAll('#kfm-list .kfm-g').forEach(e => e.remove());
      ['kfm-pager', 'kfm-bb-tog'].forEach(id => { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; });
      const bar = document.querySelector('.kfm-bottombar');
      if (bar) bar.style.visibility = 'hidden';
    });
    const listedEl = page.locator('#kfm-list .kfm-c[data-asin="B0TESTASIN"] .kfm-later');
    await listedEl.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    const cardShot = join(OUT, d.name + '-later-cards.png');
    await page.screenshot({ path: cardShot, fullPage: false });
    shots[d.name + '-cards'] = cardShot;
    const addEl = page.locator('#kfm-list .kfm-c[data-asin="B0CHARGER1"] .kfm-later');
    await addEl.scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    const addShot = join(OUT, d.name + '-later-cards-add.png');
    await page.screenshot({ path: addShot, fullPage: false });
    shots[d.name + '-cards-add'] = addShot;

    await page.evaluate(() => window.__kfmTest.openSettings());
    await page.waitForTimeout(250);
    m = await measureLater(page);
    if (!/Web App URL/.test(m.labels.join('\n'))) fail.push(d.name + ' settings missing Web App URL');
    if (!/API_KEY/.test(m.labels.join('\n'))) fail.push(d.name + ' settings missing API_KEY');
    if (!m.setUrl || !/127\.0\.0\.1|script\.google\.com/.test(m.setUrl)) fail.push(d.name + ' settings URL empty');
    if (/AIza|sk-|ghp_|xox/.test(JSON.stringify(m))) fail.push(d.name + ' unexpected secret-like string in settings dump');
    await page.click('#kfm-sheet .kfm-sh-top button');

    await page.evaluate(() => {
      ['kfm-pager', 'kfm-bb-tog'].forEach(id => { const e = document.getElementById(id); if (e) e.style.visibility = ''; });
      const bar = document.querySelector('.kfm-bottombar');
      if (bar) bar.style.visibility = '';
      window.__kfmTest.openListSheet();
    });
    await page.waitForFunction(() => document.querySelectorAll('#kfm-sheet .kfm-li').length >= 1, { timeout: 8000 });
    await page.waitForTimeout(300);
    await page.evaluate(() => document.querySelectorAll('#kfm-list .kfm-g').forEach(e => e.remove()));
    m = await measureLater(page);
    if (m.sheetTitle !== 'あとで見るリスト') fail.push(d.name + ' list title: ' + m.sheetTitle);
    if (m.lis.length < 2) fail.push(d.name + ' list items: ' + m.lis.length);
    if (m.lis.some(x => !x.del)) fail.push(d.name + ' list missing delete');
    if (m.overflow > 2) fail.push(d.name + ' list overflow ' + m.overflow);
    const listShot = join(OUT, d.name + '-later-list.png');
    await page.screenshot({ path: listShot, fullPage: false });
    shots[d.name + '-list'] = listShot;
    await ctx.close();
  }

  const { ctx, page } = await openLater(browser, base, gas, devices[1]);
  const addRes = await page.evaluate(async () => {
    const t = window.__kfmTest;
    const card = document.querySelector('#kfm-list .kfm-c[data-asin="B0CHARGER1"]');
    const d = { asin: 'B0CHARGER1', title: 'USB-C 急速充電器 65W', fields: [], all: {}, img: '' };
    await t.sendGas(d, card);
    return {
      toast: (document.getElementById('kfm-toast') || {}).textContent || '',
      listed: t.isListed('B0CHARGER1'),
      transport: { ...t.lastTransport },
      xhr: (window.__kfmXhrCalls || []).slice(-4)
    };
  });
  if (!/追加しました/.test(addRes.toast)) fail.push('add toast: ' + addRes.toast);
  if (!addRes.listed) fail.push('add did not mark listed');
  if (addRes.transport.via !== 'GM.xmlHttpRequest') fail.push('transport not GM.xmlHttpRequest: ' + addRes.transport.via);
  if (addRes.transport.ctype && !/text\/plain/i.test(addRes.transport.ctype)) fail.push('transport ctype: ' + addRes.transport.ctype);
  if ((addRes.xhr || []).some(x => x.hasJson)) fail.push('GM path sent application/json');

  const again = await page.evaluate(async () => {
    const t = window.__kfmTest;
    const card = document.querySelector('#kfm-list .kfm-c[data-asin="B0CHARGER1"]');
    const d = { asin: 'B0CHARGER1', title: 'USB-C 急速充電器 65W', fields: [], all: {}, img: '' };
    const before = (window.__kfmXhrCalls || []).length;
    await t.sendGas(d, card);
    return {
      toast: (document.getElementById('kfm-toast') || {}).textContent || '',
      extra: (window.__kfmXhrCalls || []).length - before
    };
  });
  if (!/既にあります/.test(again.toast)) fail.push('duplicate toast: ' + again.toast);

  const unauth = await page.evaluate(async () => {
    const t = window.__kfmTest;
    t.setCfg({ gasKey: 'wrong-key' });
    const r = await t.refreshList();
    return { err: t.gasErr(r), raw: r };
  });
  if (!/unauthorized/.test(unauth.err || '')) fail.push('unauthorized message: ' + unauth.err);

  await page.evaluate(() => window.__kfmTest.openSettings());
  await page.waitForSelector('#kfm-sheet .kfm-set input[type=url]', { timeout: 4000 });
  const settings = await page.evaluate(() => {
    const url = document.querySelector('#kfm-sheet .kfm-set input[type=url]');
    const key = [...document.querySelectorAll('#kfm-sheet .kfm-set input')].find(i => i.type === 'password');
    return {
      url: url ? url.value : '',
      keyVal: key ? key.value : '',
      placeholder: key ? key.placeholder : ''
    };
  });
  if (settings.keyVal && settings.keyVal !== TEST_KEY && settings.keyVal !== 'wrong-key') fail.push('settings showed unexpected key');
  // テストではモック用の仮キーだけが入る。本物のキーは使わない。
  if (!settings.url) fail.push('settings URL not prefilled');

  await ctx.close();
  return { fail, shots };
}

async function main() {
  await mkdir(OUT, { recursive: true });
  await mkdir(ART, { recursive: true });
  const gas = await createMockGas();
  const apiFail = await checkApi(gas);
  const staticSrv = await startStatic();
  const base = 'http://127.0.0.1:' + staticSrv.address().port;
  const browser = await launchBrowser();
  let ui;
  try {
    ui = await runUi(browser, base, gas);
  } finally {
    await browser.close();
    staticSrv.close();
    await gas.close();
  }

  const map = {
    'se-cards': 'later_cards_se_375.png',
    'se-cards-add': 'later_cards_se_375_add.png',
    'se-list': 'later_list_se_375.png',
    'promax16-cards': 'later_cards_16promax_440.png',
    'promax16-cards-add': 'later_cards_16promax_440_add.png',
    'promax16-list': 'later_list_16promax_440.png'
  };
  for (const [k, name] of Object.entries(map)) {
    if (ui.shots[k]) await copyFile(ui.shots[k], join(ART, name));
  }

  const failed = [...apiFail, ...ui.fail];
  if (apiFail.length) console.log('API FAIL: ' + apiFail.join('; '));
  else console.log('API ok (mocked backend, text/plain POST, unauthorized/list/exists/add/delete)');
  if (ui.fail.length) console.log('UI FAIL: ' + ui.fail.join('; '));
  else console.log('UI ok (SE 375 / 16 Pro Max 440 cards + list)');
  if (failed.length) {
    console.error(failed.length + ' check(s) failed');
    process.exit(1);
  }
  console.log('later mock checks passed, shots in', OUT);
}

main().catch(e => { console.error(e); process.exit(1); });
