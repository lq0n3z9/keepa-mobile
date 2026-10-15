// Keepa あとで見る — Google Apps Script Webアプリ（保存先: このスクリプトに紐づくスプレッドシートの「list」シート）
// スクリプトプロパティ API_KEY に長いランダム文字列を設定すること。
const SHEET = 'list';
const COLS = ['asin','title','breakEven','price','monthlySold','rank','buyBox','newPrice','keepaUrl','amazonUrl','sentAt','addedAt'];

function sheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(SHEET);
  if (!sh) { sh = ss.insertSheet(SHEET); sh.appendRow(COLS); sh.setFrozenRows(1); }
  return sh;
}
function rows_() {
  const v = sheet_().getDataRange().getValues(); v.shift();
  return v.filter(r => r[0]).map(r => Object.fromEntries(COLS.map((c, i) => [c, r[i] instanceof Date ? r[i].toISOString() : r[i]])));
}
function findRow_(asin) {
  const f = sheet_().getRange('A:A').createTextFinder(asin).matchEntireCell(true).findNext();
  return f ? f.getRow() : 0;
}
function checkKey_(k) {
  const key = PropertiesService.getScriptProperties().getProperty('API_KEY');
  if (!key || k !== key) throw new Error('unauthorized');
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// --- 操作本体 ---
function list_() { return rows_().sort((a, b) => String(b.addedAt).localeCompare(String(a.addedAt))); }
function exists_(asin) { const r = findRow_(asin); return { exists: !!r }; }
// mode: 'reject'（既存なら追加しない）/ 'update'（既存なら最新値で上書き）
function add_(p, mode) {
  const asin = String(p.asin || '').trim();
  if (!/^[A-Z0-9]{10}$/.test(asin)) return { ok: false, error: 'bad asin' };
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const r = findRow_(asin);
    if (r) {
      if (mode === 'update') {
        const old = sheet_().getRange(r, 1, 1, COLS.length).getValues()[0];
        const row = COLS.map((c, i) => c === 'addedAt' ? old[i] : (p[c] ?? old[i]));
        sheet_().getRange(r, 1, 1, COLS.length).setValues([row]);
        return { ok: true, duplicate: true, updated: true, addedAt: old[COLS.length - 1] };
      }
      return { ok: false, duplicate: true, addedAt: sheet_().getRange(r, COLS.length).getValue() };
    }
    sheet_().appendRow(COLS.map(c => c === 'addedAt' ? new Date().toISOString() : (p[c] ?? '')));
    return { ok: true, duplicate: false };
  } finally { lock.releaseLock(); }
}
function del_(asin) {
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try { const r = findRow_(asin); if (!r) return { ok: false, notFound: true }; sheet_().deleteRow(r); return { ok: true }; }
  finally { lock.releaseLock(); }
}

// --- HTTP ---
// GET ?key=...                      → 一覧ページ(HTML)
// GET ?key=...&action=list          → JSON一覧
// GET ?key=...&action=exists&asin=X → {exists}
function doGet(e) {
  const p = e.parameter;
  try { checkKey_(p.key); } catch (err) { return p.action ? json_({ ok: false, error: 'unauthorized' }) : HtmlService.createHtmlOutput('unauthorized'); }
  if (p.action === 'list') return json_({ ok: true, items: list_() });
  if (p.action === 'exists') return json_(exists_(p.asin));
  const t = HtmlService.createTemplateFromFile('Index'); t.key = p.key;
  return t.evaluate().setTitle('Keepa あとで見る').addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
// POST ?key=...  body: {"action":"add","item":{...},"mode":"reject"} / {"action":"delete","asin":"..."}
// ※Apps ScriptはHTTPヘッダーを読めないため、キーはURLの ?key= で渡す
function doPost(e) {
  try { checkKey_(e.parameter.key); } catch (err) { return json_({ ok: false, error: 'unauthorized' }); }
  const b = JSON.parse(e.postData.contents || '{}');
  if (b.action === 'add') return json_(add_(b.item || {}, b.mode || 'reject'));
  if (b.action === 'delete') return json_(del_(b.asin));
  return json_({ ok: false, error: 'unknown action' });
}
// 一覧ページ(google.script.run)用
function apiList(key) { checkKey_(key); return list_(); }
function apiDelete(key, asin) { checkKey_(key); return del_(asin); }
