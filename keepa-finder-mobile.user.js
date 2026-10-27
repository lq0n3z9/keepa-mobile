// ==UserScript==
// @name         Keepa 製品ファインダー – iPhone表示
// @namespace    keepa-finder-mobile
// @version      0.1.24
// @description  KeepaをiPhoneで使いやすくする（製品ファインダーのカード表示・トラッキング設定・トラッキング整理など）
// @match        https://keepa.com/*
// @match        https://www.keepa.com/*
// @include      https://keepa.com/*
// @match        https://keepa.co.jp/*
// @match        https://*.keepa.com/*
// @run-at       document-start
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM.xmlHttpRequest
// @grant        GM_xmlhttpRequest
// @connect      *
// @noframes
// @homepageURL  https://github.com/lq0n3z9/keepa-mobile
// @updateURL    https://raw.githubusercontent.com/lq0n3z9/keepa-mobile/main/keepa-finder-mobile.user.js
// @downloadURL  https://raw.githubusercontent.com/lq0n3z9/keepa-mobile/main/keepa-finder-mobile.user.js
// @license      MIT
// ==/UserScript==
(function () {
  'use strict';
  // ===== 設定（ここを編集）=====
  const MAX_WIDTH = 820;
  // カードに常に出す項目。col-id 優先、なければラベル部分一致。空 [] なら全項目。
  const SHOW_FIELDS = [
    'imagesCSV', 'title', 'asin',
    'SALES_current', 'SALES_avg180', 'monthlySold',
    'BUY_BOX_SHIPPING_current', 'NEW_current', 'COUNT_NEW_current', 'COUNT_NEW_avg180',
    'AMAZON_current', 'AMAZON_outOfStockPercentage90', 'NEW_FBA_current',
        'variationCSV', 'BUY_BOX_SHIPPING_avg365', 'BUY_BOX_sellerCount365', 'BUY_BOX_STATS_365'
  ];
  const HIDE_FIELDS = [];              // 全項目展開時も隠したいもの
  const COLLAPSE_SECTIONS = true;      // フィルター節を最初は閉じる
  const SECTION_TITLES = ['売上ランキングと価格タイプ', 'タイトル、カテゴリ、属性', 'オファー数',
    'Buy Box 中古', 'Buy Box', '販売者ID', 'さらに検索を絞り込みましょう'];
  // ===========================

  const FORCE_DEBUG = false;          // true か URLに kfmdebug でコンソールに構造を出力
  const FORCE_MOBILE = false;          // true にすると幅判定なしで常にスマホ表示
  const isMobile = () => FORCE_MOBILE || Math.min(screen.width, screen.height) <= MAX_WIDTH ||
    window.matchMedia('(pointer:coarse)').matches || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const mq = { get matches() { return isMobile(); } };
  let trackOn = false;   // v0.0.21: トラッキングフォーム表示中
  let prodW = 1100;   // 初期値。実測で 980〜1600 に更新
  function measureProduct() {
    if (!/^#!product/i.test(location.hash)) return;
    const root = document.querySelector('#wrapper') || document.querySelector('.mainContent') || document.body;
    const w = Math.max(root ? root.scrollWidth : 0, document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0);
    const next = Math.max(980, Math.min(1600, Math.ceil(w)));
    if (Math.abs(next - prodW) > 8) { prodW = next; setViewport(); }
  }
  function setViewport() {
    if (!isMobile()) return;
    const head = document.head || document.documentElement;
    if (!head) return; // document-start では head がまだ無いことがある
    let m = document.querySelector('meta[name="viewport"]');
    if (!m) { m = document.createElement('meta'); m.name = 'viewport'; head.appendChild(m); }
    // #!product: 画面幅に合わせ、ピンチで自由に拡大縮小。それ以外（#!finder 等）: 入力時の自動ズームを防ぐ固定倍率
    // #!product: ビューポート幅をKeepa本来のPCレイアウト幅にし、Safariに全体を縮小表示させる（レイアウトは崩さない）＋自由ズーム
    // v0.1.22: viewport-fit=cover がないと env(safe-area-inset-*) が 0 のまま（Dynamic Island / ホームインジケータ）
    const cover = 'viewport-fit=cover';
    const want = trackOn ? `width=device-width, initial-scale=1, maximum-scale=1, ${cover}`
      : /^#!product/i.test(location.hash)
      ? `width=${prodW}, minimum-scale=0.1, maximum-scale=5, user-scalable=yes, ${cover}`
      : `width=device-width, initial-scale=1, maximum-scale=1, ${cover}`;
    if (m.getAttribute('content') !== want) m.setAttribute('content', want);
  }
  function armViewportWatch() {
    setViewport();
    const root = document.documentElement;
    if (!root || typeof root.nodeType !== 'number') return;
    try {
      let vpRaf = 0;   // v0.1.17: 変化のたび毎回ではなく1フレームに1回だけ
      new MutationObserver(() => { if (vpRaf) return; vpRaf = requestAnimationFrame(() => { vpRaf = 0; if (isMobile()) setViewport(); }); })
        .observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['content'] });
    } catch (e) { /* document-start で Node 未準備のことがある */ }
  }
  window.addEventListener('hashchange', () => { setViewport(); [600, 1500, 3000].forEach(t => setTimeout(measureProduct, t)); });
  window.addEventListener('load', () => [300, 1500].forEach(t => setTimeout(measureProduct, t)));
  if (document.documentElement) armViewportWatch();
  else document.addEventListener('DOMContentLoaded', armViewportWatch);
  const VERSION = 'v0.1.24';
  // v0.1.17: iOS はスクロールでアドレスバーが伸び縮みするたび・キーボード開閉のたびに resize が来る。
  // 高さだけの変化では重い作り直しをしない（スクロールのカクつきの原因）
  // v0.1.17: 同じクラスを付け外しし直さない（html のクラス書き換えはページ全体の再計算になる。付け外しの無限ループでスクロールが重かった）
  const kc = (el, c, on) => { if (!el || !el.classList) return; on = !!on; if (el.classList.contains(c) !== on) el.classList.toggle(c, on); };
  const kfmLastW = {};
  const kfmWidthChanged = k => { const w = window.innerWidth; if (kfmLastW[k] === w) return false; kfmLastW[k] = w; return true; };
  const onFinder = () => /^#!finder/i.test(location.hash);
  const onProduct = () => /^#!product/i.test(location.hash);
  const norm = s => (s || '').replace(/\s+/g, ' ').trim();
  const cssEsc = s => { try { return (window.CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/[^a-zA-Z0-9_-]/g, '\\$&'); } catch (e) { return String(s); } };
  const has = (label, list) => list.some(k => norm(label).toLowerCase().replace(/\s/g, '')
    .includes(k.toLowerCase().replace(/\s/g, '')));

  // v0.1.17: スクロールを滑らかに・効いたり効かなかったりをなくす
  const SCROLL_CSS = `
 html.kfm body .knav-row,html.kfm.kfm-open-nav body .knav-row{flex-wrap:nowrap!important;overflow-x:auto!important;overflow-y:hidden!important;max-height:none!important;
   touch-action:pan-x pan-y;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch;scrollbar-width:none}
 html.kfm body .knav-row>*{flex:0 0 auto}
 #kfm-sort,html.kfm-tabs .knav-sub__inner,html.kfm-tabs #sellerLookupResults{touch-action:pan-x pan-y;overscroll-behavior-x:contain}
 html.kfm ul.ui-autocomplete,#kfm-cols .kfm-cols-body,#kfm-sheet .kfm-sh-list,#kfm-tm .kfm-tm-list,#kfm-tm-sheet .kfm-tm-ul,#kfm-ovf,
 html.kfm body .generalOverlay:has(.grid-filter-form--view-only),html.kfm body .generalOverlay.kfm-afov{overscroll-behavior:contain}
 #kfm-list .kfm-c{contain:layout paint}
 #kfm-pager{transform:translateZ(0);contain:layout style}

 /* v0.1.17: 画面の高さはアドレスバー込みの vh ではなく、見えている高さ (dvh) で */
 #kfm-cols .kfm-cols-sh{height:92dvh;max-height:92dvh}
 #kfm-sheet .kfm-sh{max-height:75dvh} #kfm-tm-sheet .kfm-tm-box{max-height:85dvh}
 /* v0.1.17: キーボードが開いている間（html.kfm-kb）。--kfm-vvtop/--kfm-vvh = 見えている範囲、--kfm-kb = キーボードで隠れた高さ */
 html.kfm-kb #kfm-pager,html.kfm-kb #kfm-ver,html.kfm-kb #kfm-badge,html.kfm-kb #kfm-toast{visibility:hidden!important;pointer-events:none!important}
 html.kfm-kb body .kfm-bottombar:not(.kfm-kb-host){visibility:hidden!important;pointer-events:none!important}
 html.kfm-kb body .kfm-bottombar.kfm-kb-host{top:auto!important;bottom:var(--kfm-kb,0px)!important;padding-bottom:8px!important;transition:none!important}
 html.kfm-kb #kfm-cols,html.kfm-kb #kfm-sheet,html.kfm-kb #kfm-tm-sheet,html.kfm-kb #kfm-ask,html.kfm-kb #kfm-tm{top:var(--kfm-vvtop,0px)!important;bottom:auto!important;height:var(--kfm-vvh,100%)!important}
 html.kfm-kb #kfm-cols .kfm-cols-sh{height:calc(var(--kfm-vvh,92dvh) - 8px)!important;max-height:none!important;padding-bottom:0!important}
 html.kfm-kb #kfm-sheet .kfm-sh,html.kfm-kb #kfm-tm-sheet .kfm-tm-box{max-height:calc(var(--kfm-vvh,75dvh) - 8px)!important;padding-bottom:8px!important}
 html.kfm-kb ul.ui-autocomplete{bottom:calc(var(--kfm-kb,0px) + 64px)!important;max-height:var(--kfm-acmax,40vh)!important}
 /* v0.1.17: 「フィルターへジャンプ」の候補が下バーの中で切れて見えなかった → バーの上に出す */
 html.kfm body .kfm-bottombar:focus-within{overflow:visible!important}
 html.kfm body .kfm-bottombar .content-jump{position:absolute!important;left:0!important;right:0!important;top:auto!important;bottom:calc(100% + 6px)!important;width:auto!important;
   max-height:50vh;overflow-y:auto!important;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;background:#fff!important;border:1px solid #d0d5dd;border-radius:12px;box-shadow:0 -6px 24px rgba(0,0,0,.16);box-sizing:border-box;z-index:5}
 html.kfm-kb body .kfm-bottombar.kfm-kb-host>*:not(:focus-within){display:none!important}
 html.kfm-kb body .kfm-bottombar.kfm-kb-host .content-jump{max-height:calc(var(--kfm-vvh,60vh) - 72px)!important}
 /* v0.1.21: 下パネルの開閉 */
 #kfm-bb-tog{display:none}
 html.kfm.kfm-finder body .kfm-bottombar{overflow:visible!important}
 html.kfm.kfm-finder body .kfm-bottombar #kfm-bb-tog{display:flex;position:absolute;left:50%;top:-15px;transform:translateX(-50%);width:44px;height:22px;padding:0;margin:0;
   align-items:center;justify-content:center;border-radius:11px;border:1px solid rgba(255,255,255,.7);color:#5f6b7a;cursor:pointer;z-index:2;
   background:rgba(255,255,255,.62);-webkit-backdrop-filter:blur(14px) saturate(180%);backdrop-filter:blur(14px) saturate(180%);
   box-shadow:0 2px 8px rgba(0,0,0,.12),inset 0 1px 0 rgba(255,255,255,.9);-webkit-tap-highlight-color:transparent;flex:none!important;order:-1}
 html.kfm.kfm-finder body .kfm-bottombar #kfm-bb-tog::before{content:'';position:absolute;inset:-10px -8px}
 html.kfm.kfm-finder body .kfm-bottombar #kfm-bb-tog svg{transition:transform .22s cubic-bezier(.2,.8,.2,1)}
 html.kfm-bb-min.kfm-finder body .kfm-bottombar #kfm-bb-tog svg{transform:rotate(180deg)}
 html.kfm-bb-min.kfm-finder body .kfm-bottombar>*:not(.filter-actions__trailing):not(#kfm-bb-tog){display:none!important}
 html.kfm-bb-min.kfm-finder body .kfm-bottombar .filter-actions__trailing>*:not(#totalResultsQuery):not(#filterSubmit){display:none!important}
 html.kfm-bb-min.kfm-finder body .kfm-bottombar .filter-actions__trailing{flex-wrap:nowrap!important}
 html.kfm-bb-min.kfm-finder body .kfm-bottombar #filterSubmit{flex:1 1 auto!important;width:auto!important;min-width:0!important}
 html.kfm-bb-min.kfm-finder body .kfm-bottombar{padding-top:12px!important}
 html.kfm-kb body .kfm-bottombar #kfm-bb-tog{display:none!important}
 html.kfm.kfm-finder .grid-filter-form,html.kfm.kfm-finder #grid-form-finder{padding-bottom:calc(var(--kfm-bbh,120px) + 24px)!important}
 html.kfm-kb #kfm-ac-done{bottom:var(--kfm-kb,0px)!important;padding-bottom:10px!important}
 html.kfm-kb body .generalOverlay:has(.grid-filter-form--view-only),html.kfm-kb body .generalOverlay.kfm-afov{top:calc(var(--kfm-vvtop,0px) + 8px)!important;max-height:calc(var(--kfm-vvh,100vh) - 16px)!important}
 html.kfm-kb.kfm-track #track{top:var(--kfm-vvtop,0px)!important;bottom:calc(var(--kfm-kb,0px) + 60px)!important}
 html.kfm-kb.kfm-track #kfm-trackbar{bottom:var(--kfm-kb,0px)!important;height:60px!important;box-sizing:border-box!important;padding:6px 12px!important}
`;
  const TM_CSS = `
 #kfm-tm-fab{position:fixed;right:12px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:2147483000;display:inline-flex;align-items:center;gap:6px;height:44px;padding:0 16px;border:0;border-radius:22px;background:#1a73e8;color:#fff;font:600 15px/1 -apple-system,system-ui,sans-serif;box-shadow:0 2px 10px rgba(0,0,0,.25)}
 #kfm-tm-fab svg{display:block;flex:0 0 auto}
 html.kfm-tm-on,html.kfm-tm-on body{overflow:hidden!important}
 html.kfm-tm-on #kfm-tm-fab,html.kfm-tm-on #kfm-ver{display:none!important}
 #kfm-tm{position:fixed;inset:0;z-index:2147483100;background:#f4f5f7;display:flex;flex-direction:column;font:15px/1.45 -apple-system,system-ui,"Hiragino Sans",sans-serif;color:#222;overflow:hidden;box-sizing:border-box}
 #kfm-tm *,#kfm-tm-sheet *{box-sizing:border-box}
 #kfm-tm .kfm-tm-head{background:#fff;border-bottom:1px solid #ddd;padding:calc(8px + env(safe-area-inset-top)) 12px 6px}
 #kfm-tm .kfm-tm-h{display:flex;align-items:center;gap:8px;height:40px}
 #kfm-tm .kfm-tm-ic{display:inline-flex;color:#1a73e8} #kfm-tm .kfm-tm-h b{font-size:17px}
 #kfm-tm .kfm-tm-hh{flex:1;min-width:0;display:flex;align-items:baseline;gap:8px} #kfm-tm .kfm-tm-hh b{flex:0 0 auto}
 #kfm-tm .kfm-tm-prac[hidden]{display:none} #kfm-tm .kfm-tm-prac{flex:0 0 auto;font-size:11px;font-weight:700;color:#fff;background:#1a73e8;border-radius:10px;padding:2px 8px;white-space:nowrap}
 #kfm-tm .kfm-tm-set{width:36px;height:36px;flex:0 0 36px;border:0;background:transparent;color:#666;display:inline-flex;align-items:center;justify-content:center;padding:0}
 #kfm-tm .kfm-tm-set svg{display:block}
 #kfm-tm .kfm-tm-tot{font-size:13px;color:#666;white-space:nowrap}
 #kfm-tm .kfm-tm-close{height:34px;border:1px solid #ccc;border-radius:17px;background:#fff;color:#555;display:inline-flex;align-items:center;gap:4px;padding:0 10px;font-size:13px;flex:0 0 auto}
 #kfm-tm .kfm-tm-close svg{display:block}
 #kfm-tm .kfm-tm-tools{display:flex;align-items:center;gap:8px;margin-top:4px}
 #kfm-tm .kfm-tm-all{display:inline-flex;align-items:center;gap:6px;white-space:nowrap;font-size:14px;height:40px}
 #kfm-tm .kfm-tm-q{flex:1;min-width:0;height:38px;border:1px solid #ccc;border-radius:10px;padding:0 10px;font-size:16px;background:#fafafa}
 #kfm-tm .kfm-tm-reload{width:38px;height:38px;flex:0 0 38px;border:1px solid #ccc;border-radius:10px;background:#fff;color:#555;display:inline-flex;align-items:center;justify-content:center;padding:0}
 #kfm-tm .kfm-tm-sub{display:flex;align-items:center;gap:6px;padding:4px 2px 0}
 #kfm-tm .kfm-tm-cnt{flex:1;min-width:0;font-size:12px;color:#777} #kfm-tm .kfm-tm-cnt.warn{color:#b37400;font-weight:600}
 #kfm-tm .kfm-tm-ver{border:0;background:transparent;color:#ccc;font-size:10px;padding:2px 4px;flex:0 0 auto}
 #kfm-tm .kfm-tm-dbg{margin:4px 0 0;padding:6px 8px;background:#222;color:#cfc;font:11px/1.4 ui-monospace,Menlo,monospace;white-space:pre-wrap;word-break:break-all;border-radius:6px;max-height:30vh;overflow:auto}
 html.kfm-manage .kfm-tm-grid{position:fixed!important;left:0!important;top:0!important;width:100vw!important;height:100vh!important;opacity:0!important;pointer-events:none!important;z-index:2147482000!important;overflow:auto!important}
 #kfm-tm .kfm-tm-list{flex:1;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;padding:8px 10px 12px}
 #kfm-tm .kfm-tm-top{display:flex;align-items:flex-start;gap:10px;min-width:0}
 #kfm-tm .kfm-tm-top>input{margin-top:16px!important}
 #kfm-tm .kfm-tm-del1{flex:0 0 40px;width:40px;height:40px;border:1px solid #f1c4c4;border-radius:10px;background:#fff;color:#d32f2f;display:inline-flex;align-items:center;justify-content:center;padding:0}
 #kfm-tm .kfm-tm-del1 svg{display:block}
 #kfm-tm .kfm-tm-pt{margin-top:4px;display:flex;flex-direction:column;gap:1px}
 #kfm-tm .kfm-tm-pr{display:grid;grid-template-columns:58px 1fr 1fr;gap:4px;font-size:12px;line-height:1.5;min-width:0}
 #kfm-tm .kfm-tm-pl{color:#777} #kfm-tm .kfm-tm-pg{color:#b00060;font-weight:600;white-space:nowrap} #kfm-tm .kfm-tm-pn{color:#333;white-space:nowrap}
 html.kfm-manage,html.kfm-manage body{overflow-x:hidden!important;max-width:100vw}
 #kfm-tm .kfm-tm-card{display:block;background:#fff;border:2px solid transparent;border-radius:12px;padding:10px;margin:0 0 8px;box-shadow:0 1px 2px rgba(0,0,0,.08);min-width:0}
 #kfm-tm .kfm-tm-card.on{border-color:#d32f2f;background:#fff6f6}
 #kfm-tm input[type=checkbox],#kfm-tm-sheet input[type=checkbox]{-webkit-appearance:none;appearance:none;flex:0 0 24px;width:24px;height:24px;margin:0;border:2px solid #999;border-radius:6px;background:#fff}
 #kfm-tm input[type=checkbox]:checked{background:#d32f2f url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M5 12.5l4.5 4.5L19 7.5' fill='none' stroke='%23fff' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/18px no-repeat;border-color:#d32f2f}
 #kfm-tm .kfm-tm-dry input[type=checkbox]:checked{background-color:#1a73e8;border-color:#1a73e8}
 #kfm-tm .kfm-tm-card img{width:56px;height:56px;flex:0 0 56px;margin-top:2px;object-fit:contain;background:#fff;border-radius:6px}
 #kfm-tm .kfm-tm-tx{flex:1;min-width:0}
 #kfm-tm .kfm-tm-t{font-size:14px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-all}
 #kfm-tm .kfm-tm-a{font:12px/1.4 ui-monospace,Menlo,monospace;color:#666;margin-top:2px}
 #kfm-tm .kfm-tm-p{font-size:12px;color:#b00060;margin-top:1px;overflow-wrap:anywhere}
 #kfm-tm .kfm-tm-r{font-size:12px;font-weight:600;margin-top:2px} #kfm-tm .kfm-tm-r.ok{color:#1a7f37} #kfm-tm .kfm-tm-r.ng{color:#b37400} #kfm-tm .kfm-tm-r.dry{color:#1a73e8}
 #kfm-tm .kfm-tm-dg{font:11px/1.4 ui-monospace,Menlo,monospace;color:#666;background:#f3f3f3;border-radius:6px;padding:4px 6px;margin-top:4px;overflow-wrap:anywhere}
 #kfm-tm .kfm-tm-empty{text-align:center;color:#888;padding:40px 0}
 #kfm-tm .kfm-tm-bar{background:#fff;border-top:1px solid #ddd;padding:8px 12px calc(8px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:8px}
 #kfm-tm .kfm-tm-dry{display:flex;align-items:center;gap:8px;font-size:14px;height:28px}
 #kfm-tm .kfm-tm-go{display:flex;align-items:center;justify-content:center;gap:8px;height:50px;width:100%;border:0;border-radius:12px;background:#d32f2f;color:#fff;font-size:17px;font-weight:700}
 #kfm-tm .kfm-tm-go.dry{background:#1a73e8} #kfm-tm .kfm-tm-go:disabled{background:#bbb}
 #kfm-tm .kfm-tm-go svg{display:block;flex:0 0 auto}
 #kfm-tm-sheet{position:fixed;inset:0;z-index:2147483200;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;font:15px/1.45 -apple-system,system-ui,"Hiragino Sans",sans-serif;color:#222}
 #kfm-tm-sheet .kfm-tm-box{background:#fff;width:100%;max-height:85vh;border-radius:16px 16px 0 0;padding:16px 14px calc(12px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:8px}
 #kfm-tm-sheet .kfm-tm-st{font-size:17px;font-weight:700}
 #kfm-tm-sheet .kfm-tm-sn{font-size:13px;color:#555}
 #kfm-tm-sheet .kfm-tm-ul{overflow-y:auto;overflow-x:hidden;border:1px solid #eee;border-radius:10px;min-height:60px}
 #kfm-tm-sheet .kfm-tm-li{display:flex;gap:8px;padding:8px 10px;border-bottom:1px solid #f0f0f0;font-size:13px;min-width:0}
 #kfm-tm-sheet .kfm-tm-li b{font:600 12px/1.6 ui-monospace,Menlo,monospace;flex:0 0 auto} #kfm-tm-sheet .kfm-tm-li span{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 #kfm-tm-sheet .kfm-tm-li{flex-wrap:wrap;align-items:center} #kfm-tm-sheet .kfm-tm-lt{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis} #kfm-tm-sheet .kfm-tm-li span.kfm-tm-ls{flex:0 0 auto;margin-left:8px;font-size:12px;font-weight:600;color:#888} #kfm-tm-sheet .kfm-tm-ls.ok{color:#1a7f37} #kfm-tm-sheet .kfm-tm-ls.ng{color:#b37400} #kfm-tm-sheet .kfm-tm-ls.now{color:#1a73e8} #kfm-tm-sheet .kfm-tm-why{flex:1 0 100%;font-size:12px;color:#8a5a00} #kfm-tm-sheet .kfm-tm-dg{flex:1 0 100%;font:11px/1.4 ui-monospace,Menlo,monospace;color:#555;overflow-wrap:anywhere}
 #kfm-tm-sheet .kfm-tm-li.now{background:#fff8d6} #kfm-tm-sheet .kfm-tm-li.ok{background:#e9f7ee} #kfm-tm-sheet .kfm-tm-li.ng{background:#fdf1dc} #kfm-tm-sheet .kfm-tm-li.dry{background:#e8f0fe}
 #kfm-tm-sheet .kfm-tm-prog{font-size:14px;font-weight:600;min-height:20px}
 #kfm-tm-sheet .kfm-tm-btns{display:flex;gap:10px}
 #kfm-tm-sheet .kfm-tm-btns button{flex:1;height:50px;border-radius:12px;font-size:16px;font-weight:700;border:0}
 #kfm-tm-sheet .kfm-tm-no{background:#eee;color:#333} #kfm-tm-sheet .kfm-tm-yes{background:#d32f2f;color:#fff} #kfm-tm-sheet .kfm-tm-yes.dry{background:#1a73e8}
 #kfm-tm-sheet .kfm-tm-no.kfm-tm-stop{background:#fff;color:#d32f2f;border:2px solid #d32f2f}
 #kfm-pager .kfm-pg-trk{width:32px;height:32px;border-radius:50%;border:0;background:transparent;color:#888;padding:0;margin-left:4px;display:inline-flex;align-items:center;justify-content:center}
`;
  const css = `
 html.kfm body .knav-row{flex-wrap:wrap!important;overflow-x:auto!important;max-height:44px;font-size:13px}
 html.kfm.kfm-open-nav body .knav-row{max-height:none}
 /* grid: clip host so it never widens the page */
 html.kfm,html.kfm body{width:100%!important;max-width:100vw!important;box-sizing:border-box}
 html.kfm body .ag-root-wrapper.kfm-gridhost{position:fixed!important;left:0!important;top:0!important;width:1px!important;height:1px!important;
   overflow:hidden!important;pointer-events:none!important;margin:0!important;padding:0!important;border:0!important}
 html.kfm body .kfm-gridhost .ag-root{position:absolute!important;left:0!important;top:0!important;width:8000px!important;height:700px!important;
   transform:none!important;opacity:0!important}
 html.kfm body .kfm-gridhost .ag-paging-panel{opacity:0!important;pointer-events:none!important}
 #kfm-sort{display:flex;gap:6px;align-items:center;overflow-x:auto;padding:6px 8px 2px;-webkit-overflow-scrolling:touch}
 #kfm-sort button{flex:0 0 auto;border:1px solid #d6d9de;background:#fff;border-radius:16px;padding:6px 12px;font-size:13px;color:#333;white-space:nowrap}
 #kfm-sort .kfm-sort-main{font-weight:700;border-color:#36c;color:#36c}
 #kfm-sort button.on{background:#36c;color:#fff;border-color:#36c}
 #kfm-sheet{position:fixed;inset:0;z-index:2147483300;background:rgba(0,0,0,.35);display:flex;align-items:flex-end}
 #kfm-sheet .kfm-sh{background:#fff;width:100%;max-height:75vh;border-radius:14px 14px 0 0;display:flex;flex-direction:column;padding-bottom:env(safe-area-inset-bottom)}
 #kfm-sheet .kfm-sh-top{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px;border-bottom:1px solid #eee;font-weight:700}
 #kfm-sheet .kfm-sh-top button{border:1px solid #ccc;background:#f5f6f8;border-radius:16px;padding:6px 12px;font-size:14px}
 #kfm-sheet .kfm-sh-list{overflow-y:auto;-webkit-overflow-scrolling:touch}
 #kfm-sheet .kfm-sh-list div{padding:12px 14px;border-bottom:1px solid #f0f0f0;font-size:15px}
 #kfm-sheet .kfm-sh-list div.on{color:#36c;font-weight:700}
 html.kfm-finder .kfm-fe-bar{display:flex;gap:8px;align-items:center;padding:8px 4px}
 html.kfm-finder .kfm-fe-bar button{border:1px solid #ccc;background:#f5f6f8;border-radius:16px;padding:6px 12px;font-size:13px}
 html.kfm-finder .kfm-fe-bar button.on{background:#36c;color:#fff;border-color:#36c}
 html.kfm-finder .kfm-fe-x{position:absolute!important;top:2px;right:2px;width:32px;height:32px;border:0;background:transparent;color:#999;font-size:16px;z-index:3;padding:0;line-height:32px}
 html.kfm-finder:not(.kfm-fedit) .filter-row.kfm-rowhidden{display:none!important}
 html.kfm-finder.kfm-fedit .filter-row.kfm-rowhidden{opacity:.4}
 html.kfm-finder .kfm-fe-bar{flex-wrap:wrap}
 #kfm-sheet .kfm-hrow{display:flex;align-items:center;justify-content:space-between;gap:10px}
 #kfm-sheet .kfm-hrow button{flex:0 0 auto;border:1px solid #36c;background:#fff;color:#36c;border-radius:16px;padding:6px 14px;font-size:14px}
 html.kfm-finder .kfm-fe-bar .kfm-fe-all{background:transparent!important;border-color:transparent!important;color:#888!important;font-size:12px!important}
 html.kfm-finder .kfm-fe-pill{background:#ffe9b3!important;border-color:#f0b400!important;color:#7a5200!important;font-weight:700}
 html.kfm-finder .kfm-fe-warn{flex:1 1 100%;color:#c62828;font-size:13px;font-weight:700}
 html.kfm-finder.kfm-fedit .filter-row.kfm-rowwarn{outline:2px solid #e53935;outline-offset:-2px;opacity:.7}
 html.kfm .kfm-search.kfm-warn{position:relative}
 html.kfm .kfm-search.kfm-warn::after{content:'⚠';position:absolute;top:-6px;right:-6px;background:#e53935;color:#fff;font-size:11px;line-height:18px;width:18px;height:18px;border-radius:50%;text-align:center}
 html.kfm-finder.kfm-fedit .kfm-fe-x{color:#36c;font-size:18px}
 /* アクティブな製品ファインダーフィルター popup (real DOM) */
 html.kfm body .generalOverlay:has(.grid-filter-form--view-only),html.kfm body .generalOverlay.kfm-afov{position:fixed!important;left:8px!important;right:8px!important;top:70px!important;bottom:auto!important;
   width:auto!important;max-width:none!important;min-width:0!important;margin:0!important;transform:none!important;
   max-height:calc(100vh - 160px)!important;overflow-y:auto!important;overflow-x:hidden!important;box-sizing:border-box!important;
   -webkit-overflow-scrolling:touch;z-index:100000}
 html.kfm body .relativeAlignCenter:has(.grid-filter-form--view-only){justify-content:flex-start!important;align-items:flex-start!important;transform:none!important}
 html.kfm body .generalOverlay .card,html.kfm body .generalOverlay #popupMessage,html.kfm.kfm-finder body .grid-filter-form.grid-filter-form--view-only,
 html.kfm.kfm-finder body .grid-filter-form.grid-filter-form--view-only section,html.kfm.kfm-finder body .grid-filter-form.grid-filter-form--view-only .filter-row,html.kfm.kfm-finder body .grid-filter-form.grid-filter-form--view-only .filter-row>div,html.kfm.kfm-finder body .grid-filter-form.grid-filter-form--view-only .filter-category--wrapper{
   width:100%!important;max-width:100%!important;min-width:0!important;margin-right:0!important;box-sizing:border-box!important}
 html.kfm body .generalOverlay #shareChartOverlay-close{position:sticky!important;top:0;float:right;z-index:10;background:#fff;border-radius:50%}
 html.kfm.kfm-finder body .grid-filter-form.grid-filter-form--view-only *{box-sizing:border-box}
 html.kfm.kfm-finder body .grid-filter-form.grid-filter-form--view-only .filter-row{display:block!important}
 html.kfm.kfm-finder body .grid-filter-form.grid-filter-form--view-only .filter-row>div{display:block!important;white-space:normal!important}
 html.kfm.kfm-finder body .grid-filter-form.grid-filter-form--view-only .filter-range--cell{display:flex!important;align-items:center!important;gap:10px;width:100%!important;max-width:100%!important;
   float:none!important;margin:0!important;padding:6px 2px!important;border-bottom:1px solid #f0f0f0;height:auto!important;min-height:0!important}
 html.kfm.kfm-finder body .grid-filter-form.grid-filter-form--view-only .filter-range--label{font-size:13px!important;font-style:normal!important;color:#666!important;flex:1 1 auto!important;min-width:0!important;
   width:auto!important;text-align:left!important;line-height:1.4!important;margin:0!important;padding:0!important;position:static!important}
 html.kfm.kfm-finder body .grid-filter-form.grid-filter-form--view-only .filter-range--input{display:flex!important;align-items:center!important;justify-content:flex-end!important;margin-left:auto!important;
   line-height:1.4!important;width:auto!important;flex:0 0 auto!important;gap:0;position:static!important;padding:0!important;height:auto!important}
 html.kfm.kfm-finder body .grid-filter-form.grid-filter-form--view-only .filter-range--input>div{display:inline-flex!important;align-items:center!important;line-height:normal!important;font-size:0!important;
   color:transparent!important;width:auto!important;padding:0!important;margin:0!important;position:static!important;height:auto!important;vertical-align:middle}
 html.kfm.kfm-finder body .grid-filter-form.grid-filter-form--view-only .filter-range--input>div br{display:none!important}
 html.kfm.kfm-finder body .grid-filter-form.grid-filter-form--view-only .filter-range--input>div b{font-size:14px!important;font-weight:700!important;color:#222!important;line-height:1.4!important}
 html.kfm.kfm-finder body .grid-filter-form.grid-filter-form--view-only .filter-range--input>div:not(:has(b))::after{content:'-';font-size:14px;color:#bbb;line-height:1.4}
 html.kfm.kfm-finder body .grid-filter-form.grid-filter-form--view-only .filter-range--input>div+div::before{content:'–';font-size:14px;color:#999;margin:0 6px;line-height:1.4}
 html.kfm.kfm-finder body .grid-filter-form.grid-filter-form--view-only .filter-range--label.inactive,html.kfm.kfm-finder body .grid-filter-form.grid-filter-form--view-only .filter-range--input.inactive{opacity:.35}
 html.kfm.kfm-finder body .grid-filter-form.grid-filter-form--view-only .filter-range--cell:has(.inactive){display:none!important}
 html.kfm.kfm-finder body .grid-filter-form.grid-filter-form--view-only .filter-row.kfm-allinactive{display:none!important}
 html.kfm.kfm-finder body .grid-filter-form.grid-filter-form--view-only .filter-category--wrapper>p{display:flex!important;align-items:center;justify-content:space-between;gap:10px;margin:0!important;padding:6px 2px!important;border-bottom:1px solid #f0f0f0;line-height:1.4}
 html.kfm.kfm-finder body .grid-filter-form.grid-filter-form--view-only .filter-category--wrapper>p>span{font-size:13px!important;color:#666!important;font-style:normal!important;flex:1 1 auto;min-width:0}
 html.kfm.kfm-finder body .grid-filter-form.grid-filter-form--view-only .filter-category--wrapper>p>b{font-size:14px!important;color:#222!important;text-align:right;margin-left:auto;overflow-wrap:anywhere}
 #kfm-pager{position:fixed;left:0;right:0;bottom:0;z-index:9998;display:flex;align-items:center;justify-content:space-between;gap:8px;
   background:#fff;border-top:1px solid #e3e5e8;box-shadow:0 -2px 8px rgba(0,0,0,.08);padding:8px 10px;box-sizing:border-box;
   font-family:-apple-system,BlinkMacSystemFont,sans-serif;-webkit-tap-highlight-color:transparent}
 #kfm-pager.kfm-pg-solo{padding-bottom:calc(8px + env(safe-area-inset-bottom))}
 #kfm-pager .kfm-pg-info{display:flex;flex-direction:column;min-width:0;font-size:12px;color:#777;line-height:1.3}
 #kfm-pager .kfm-pg-ver{font-size:9px;color:#c4c4c4;pointer-events:auto;cursor:pointer;padding:2px 0}
#kfm-pager .kfm-pg-ver.kfm-ovf{}
/* v0.0.21: finder ではページ全体の横はみ出しを禁止（clip はスクロール領域を作らないので候補リストを壊さない） */
html.kfm.kfm-finder,html.kfm.kfm-finder body{width:100%!important;max-width:100%!important;min-width:0!important;overflow-x:clip!important}
@supports not (overflow:clip){html.kfm.kfm-finder,html.kfm.kfm-finder body{overflow-x:hidden!important}}
/* v0.1.11: 結果領域を viewport 幅に拘束し、ツールバーだけ 4 列 */
html.kfm.kfm-finder #contentAlign{
  margin-left:0!important;margin-right:0!important;width:100%!important;max-width:100%!important;
  min-width:0!important;box-sizing:border-box!important;padding:0!important}
html.kfm.kfm-finder #content,html.kfm.kfm-finder #bodyPanel,html.kfm.kfm-finder .content,
html.kfm.kfm-finder .data-container,html.kfm.kfm-finder .data-container.asin{
  width:100%!important;max-width:100%!important;min-width:0!important;box-sizing:border-box!important;
  overflow-x:clip!important;float:none!important;margin-left:0!important;margin-right:0!important;
  left:0!important;right:auto!important;transform:none!important}
html.kfm.kfm-finder .data-container{display:flex!important;flex-direction:column!important;align-items:stretch!important}
html.kfm.kfm-finder .finder-query{
  display:flex!important;flex-wrap:wrap!important;align-items:center!important;gap:6px 8px!important;
  width:100%!important;max-width:100%!important;min-width:0!important;box-sizing:border-box!important;
  margin:0!important;padding:4px 8px!important;overflow:visible!important}
html.kfm.kfm-finder .finder-query>*{flex:0 1 auto;min-width:0;max-width:100%}
html.kfm.kfm-finder .grid-wrapper-tools.kfm-tools{
  display:block!important;width:100%!important;max-width:100%!important;min-width:0!important;
  margin:0!important;padding:4px 6px!important;box-sizing:border-box!important;overflow:hidden!important;float:none!important;height:auto!important}
html.kfm.kfm-finder .grid-wrapper-tools.kfm-tools>div.kfm-tools-row,
html.kfm.kfm-finder .grid-wrapper-tools.kfm-tools>div:first-child{
  width:100%!important;max-width:100%!important;box-sizing:border-box!important;
  padding-left:0!important;padding-right:0!important;margin:0!important}
html.kfm.kfm-finder .grid-wrapper-tools.kfm-tools>div.kfm-tools-row,
html.kfm.kfm-finder .grid-wrapper-tools.kfm-tools>div:first-child{
  display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:4px 6px!important;
  width:100%!important;max-width:100%!important;min-width:0!important;margin:0!important;padding:0!important;
  box-sizing:border-box!important;overflow:hidden!important;float:none!important;align-items:stretch}
html.kfm.kfm-finder .grid-wrapper-tools.kfm-tools>div.kfm-tools-row>span,
html.kfm.kfm-finder .grid-wrapper-tools.kfm-tools>div:first-child>span{
  min-width:0!important;max-width:100%!important;width:auto!important;margin:0!important;padding:0!important;
  float:none!important;position:static!important;box-sizing:border-box!important;overflow:hidden!important}
html.kfm.kfm-finder .grid-wrapper-tools.kfm-tools .trigger{
  display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;
  gap:2px!important;width:100%!important;max-width:100%!important;min-width:0!important;min-height:44px;
  padding:4px 2px!important;margin:0!important;font-size:11px!important;line-height:1.15!important;
  box-sizing:border-box!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
html.kfm.kfm-finder .grid-wrapper-tools.kfm-tools .trigger i,
html.kfm.kfm-finder .grid-wrapper-tools.kfm-tools .trigger svg{flex:0 0 auto;font-size:14px!important;width:16px;height:16px}
/* チップ見出しが誤って toolbar 扱いになってもグリッドにしない */
html.kfm.kfm-finder .finder-query .kfm-toolbar,
html.kfm.kfm-finder .finder-pills .kfm-toolbar,
html.kfm.kfm-finder .finder-saved .kfm-toolbar{display:revert!important;grid-template-columns:none!important}
html.kfm.kfm-finder #kfm-sort{max-width:100%;box-sizing:border-box}
/* ---- v0.0.21 トラッキング（スマホ用1列フォーム・実DOM準拠）---- */
html.kfm-track #track{position:fixed!important;left:0!important;top:0!important;right:0!important;bottom:calc(68px + env(safe-area-inset-bottom))!important;width:auto!important;max-width:none!important;height:auto!important;
  margin:0!important;z-index:2147483000!important;background:#f4f5f7!important;overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch;
  padding:12px 12px 24px!important;box-sizing:border-box!important;font-size:15px!important;transform:none!important;opacity:1!important;
  touch-action:pan-y!important;overscroll-behavior:contain;pointer-events:auto!important}
/* v0.1.2: トラッキング画面ではページ全体のスクロールを止めない。Keepaの読み込み中レイヤーにタッチを取らせない */
html.kfm-track:not(.kfm-tm-on),html.kfm-track:not(.kfm-tm-on) body{overflow-y:visible!important;position:static!important;height:auto!important;touch-action:auto!important}
html.kfm-track #networkOverlay,html.kfm-track #networkBar,html.kfm-track #loadingBar,html.kfm-track #overlayShadow.hidden,html.kfm-track #productOverlay.hidden{pointer-events:none!important}
html.kfm-track #track.kfm-trk-nudge{overflow-y:hidden!important}
html.kfm-track #track *{box-sizing:border-box;max-width:100%}
html.kfm-track #track .tracking,html.kfm-track #track form#trackingForm,html.kfm-track #track section,html.kfm-track #track .panels,html.kfm-track #track .panel.active{width:100%!important;min-width:0!important;float:none!important;height:auto!important}
html.kfm-track #track .colorTip,html.kfm-track #track .tracking__suggestion,html.kfm-track #track .mdc-text-field__icon,html.kfm-track #track .tracking__block>br,html.kfm-track #track .tracking__block--meta>br{display:none!important}
html.kfm-track #track input,html.kfm-track #track select,html.kfm-track #track textarea{font-size:16px!important}
html.kfm-track #track [data-mode]{height:auto!important}
/* 行カード：grid 1=見出し 2=入力+以下/以上 3=チェック 4=説明 5=現在価格 */
html.kfm-track #track .tracking__block{display:grid!important;grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"t t" "i s" "c c" "h h" "x x";
  column-gap:10px;row-gap:8px;align-items:center;height:auto!important;min-height:0!important;width:100%!important;margin:0 0 12px!important;padding:12px!important;
  background:#fff!important;border:1px solid #dde0e4;border-left:5px solid var(--csvtype-color,#36c);border-radius:12px;position:relative!important}
html.kfm-track #track .tracking__block>*{position:static!important;top:auto!important;left:auto!important;right:auto!important;bottom:auto!important;margin:0!important;transform:none!important;float:none!important;min-width:0}
html.kfm-track #track .tracking__block>.mdc-text-field{display:contents!important}
html.kfm-track #track .tracking__block .mdc-floating-label{grid-area:t;position:static!important;transform:none!important;left:auto!important;top:auto!important;width:auto!important;
  font-size:16px!important;font-weight:700!important;color:#222!important;white-space:normal!important;overflow:visible!important;line-height:1.3!important;pointer-events:none}
html.kfm-track #track .tracking__block input.mdc-text-field__input{grid-area:i;display:block!important;width:100%!important;height:48px!important;margin:0!important;padding:0 12px!important;
  border:1px solid #c7ccd1!important;border-radius:10px!important;background:var(--csvtype-color-bg,#fff)!important;font-size:20px!important;font-weight:700;text-align:right;color:#111;position:static!important}
html.kfm-track #track .tracking__block .mdc-text-field--disabled input.mdc-text-field__input{opacity:.5}
html.kfm-track #track .tracking__block .mdc-line-ripple,html.kfm-track #track .tracking__block .mdc-notched-outline{display:none!important}
html.kfm-track #track .trigger--switch-isdrop{grid-area:s;display:inline-flex!important;align-items:center;justify-content:center;gap:4px;height:44px;min-width:76px;padding:0 14px!important;
  border:1px solid #36c;border-radius:22px;color:#36c!important;font-size:15px!important;font-weight:700;background:#f3f7ff;cursor:pointer;white-space:nowrap}
html.kfm-track #track .tracking__stock-options{grid-area:c;display:flex!important;flex-wrap:wrap;gap:8px;height:auto!important;padding:0!important;opacity:1!important}
html.kfm-track #track .tracking__stock-options[hidden]{display:none!important}
html.kfm-track #track .mdc-text-field-helper-text{grid-area:h;display:block!important;font-size:12px!important;line-height:1.4!important;color:#888!important;opacity:1!important;margin:0!important}
html.kfm-track #track .kfm-cur{grid-area:x;font-size:13px;color:#555}
html.kfm-track #track .kfm-cur b{color:#111}
/* チェックボックス＝チップ */
html.kfm-track #track .tracking__stock-options .mdc-form-field,html.kfm-track #track .tracking__block-switches .mdc-form-field{display:inline-flex!important;align-items:center;gap:4px;margin:0!important;
  min-height:44px;padding:0 12px 0 2px!important;border:1px solid #dde0e4;border-radius:22px;background:#fafbfc;font-size:15px!important}
html.kfm-track #track .mdc-form-field>label{font-size:15px!important;padding:8px 0!important;cursor:pointer;line-height:1.3}
html.kfm-track #track .tracking__block-switches{display:flex!important;flex-wrap:wrap;gap:8px;height:auto!important;margin:0 0 12px!important;padding:12px!important;background:#fff;border:1px solid #dde0e4;border-radius:12px}
html.kfm-track #track .tracking__block-switches .mdc-form-field{border-radius:12px}
/* メモ・タグ */
html.kfm-track #track .tracking__block--meta{display:grid!important;gap:12px;width:100%!important;margin:0 0 12px!important;padding:12px!important;background:#fff;border:1px solid #dde0e4;border-radius:12px}
html.kfm-track #track .tracking__block--meta .mdc-text-field{display:flex!important;flex-direction:column;gap:4px;width:100%!important;height:auto!important;margin:0!important}
html.kfm-track #track .tracking__block--meta .mdc-floating-label{position:static!important;transform:none!important;font-size:14px!important;font-weight:700;color:#222!important}
html.kfm-track #track .tracking__block--meta input{order:2;width:100%!important;height:44px!important;padding:0 10px!important;border:1px solid #c7ccd1!important;border-radius:10px!important;background:#fff}
/* 期限・保存 */
html.kfm-track #track .tracking__buttons{display:grid!important;gap:6px;margin:12px 0!important;padding:12px!important;background:#fff;border:1px solid #dde0e4;border-radius:12px}
html.kfm-track #track .tracking__buttons>.colorTipContainer{font-weight:700;font-size:14px}
html.kfm-track #track .tracking__buttons .mdc-select{width:100%!important;height:auto!important}
html.kfm-track #track select#tracking-ttl{display:block!important;width:100%!important;height:48px!important;border:1px solid #c7ccd1!important;border-radius:10px!important;background:#fff!important;padding:0 10px!important}
/* モード＝セグメント */
html.kfm-track #track .tracking__settings-mode{display:block!important;padding:4px 0 0}
html.kfm-track #track .kfm-seg{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr));width:100%;margin:8px 0 12px!important;gap:0}
html.kfm-track #track .kfm-seg>:not(.kfm-seg-item){grid-column:1/-1;grid-row:1;font-weight:700;font-size:14px;margin:0 0 6px!important}
html.kfm-track #track .kfm-seg-item{display:flex!important;align-items:center;justify-content:center;min-height:44px;margin:0!important;padding:0 4px!important;border:1px solid #36c!important;border-left-width:0!important;background:#fff;color:#36c;font-weight:700;position:relative}
html.kfm-track #track .kfm-seg-item{grid-row:2;order:0}
html.kfm-track #track .kfm-seg-item.kfm-mid{grid-column:2}
html.kfm-track #track .kfm-seg-item.kfm-first{grid-column:1;border-left-width:1px!important;border-radius:10px 0 0 10px}
html.kfm-track #track .kfm-seg-item.kfm-last{grid-column:3;border-radius:0 10px 10px 0}
html.kfm-track #track .kfm-seg-item .mdc-radio{position:absolute!important;inset:0;opacity:0;width:auto!important;height:auto!important;padding:0!important}
html.kfm-track #track .kfm-seg-item .mdc-radio input{width:100%!important;height:100%!important;margin:0!important}
html.kfm-track #track .kfm-seg-item.kfm-on{background:#36c!important;color:#fff!important}
html.kfm-track #track .kfm-seg-item label{color:inherit!important;font-size:15px!important;padding:12px 0!important;text-align:center;width:100%}
/* 下部バー */
#kfm-trackbar{display:none}
html.kfm-track #kfm-trackbar{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:2147482990;gap:8px;align-items:center;height:calc(68px + env(safe-area-inset-bottom));padding:10px 12px calc(10px + env(safe-area-inset-bottom));
  background:#fff;border-top:1px solid #ddd;box-shadow:0 -2px 8px rgba(0,0,0,.08)}
#kfm-trackbar .kfm-tb-back{flex:0 0 auto;width:132px;height:48px;padding:0 10px;border:1px solid #bbb;border-radius:10px;background:#fff;color:#222;font:700 15px -apple-system,sans-serif}
html.kfm-track #track #submitTracking{position:static!important;display:flex!important;align-items:center;justify-content:center;gap:6px;width:100%!important;height:48px!important;margin:6px 0 0!important;border:0!important;border-radius:10px!important;
  background:#1a73e8!important;background-image:none!important;color:#fff!important;opacity:1!important;filter:none!important;font:800 16px -apple-system,sans-serif!important;box-shadow:none!important;text-transform:none!important;visibility:visible!important;transform:none!important}
html.kfm-track #track #submitTracking::before,html.kfm-track #track #submitTracking::after{opacity:0!important;background:transparent!important}
html.kfm-track #track #submitTracking *{color:#fff!important}
#kfm-trackbar .kfm-tb-save{flex:1 1 auto;height:48px;border:0;border-radius:10px;background:#1a73e8;color:#fff;opacity:1;font:800 16px -apple-system,sans-serif;box-shadow:0 2px 6px rgba(26,115,232,.35)}
#kfm-trackbar .kfm-tb-save:disabled{background:#9db8e6;box-shadow:none}
/* チェックボックス：MDCの見た目を消し、22pxの自前ボックス */
html.kfm-track #track .mdc-checkbox{display:inline-flex!important;align-items:center;justify-content:center;position:static!important;width:22px!important;height:22px!important;flex:0 0 22px!important;padding:0!important;margin:0!important;transform:none!important;background:none!important}
html.kfm-track #track .mdc-checkbox::before,html.kfm-track #track .mdc-checkbox::after{display:none!important;content:none!important}
html.kfm-track #track .mdc-checkbox__background,html.kfm-track #track .mdc-checkbox__mixedmark,html.kfm-track #track .mdc-checkbox__ripple{display:none!important}
html.kfm-track #track input[type=checkbox]{-webkit-appearance:none!important;appearance:none!important;position:static!important;opacity:1!important;display:block!important;width:22px!important;height:22px!important;margin:0!important;padding:0!important;
  border:2px solid #8a929b!important;border-radius:5px!important;background:#fff!important;accent-color:#1a73e8;cursor:pointer;flex:0 0 22px;top:auto!important;left:auto!important;z-index:auto!important}
html.kfm-track #track input[type=checkbox]:checked{background:#1a73e8 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M5 12.5l4.5 4.5L19 7.5' fill='none' stroke='%23fff' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/18px no-repeat!important;border-color:#1a73e8!important}
html.kfm-track #track .mdc-form-field:has(input[type=checkbox]:checked){background:#e8f0fe!important;border-color:#1a73e8!important}
html.kfm-track #track .tracking__stock-options .mdc-form-field,html.kfm-track #track .tracking__block-switches .mdc-form-field{display:inline-flex!important;align-items:center!important;gap:8px!important;padding:6px 14px 6px 10px!important}
html.kfm-track #track .mdc-form-field>label{line-height:22px!important;padding:4px 0!important;margin:0!important}
html.kfm-track #track .tracking__submit-overlay:not(.active){display:none}
html.kfm-track #track .tracking section section{display:block!important}
html.kfm-track #track .tracking section section>div{width:100%!important;flex:none!important;padding:0!important;margin:0!important}
html.kfm-track #track .tracking section section>div[style*="flex"]{margin:0 0 12px!important;padding:0 2px!important}
html.kfm-track #track .tracking hr{margin:8px 0!important}
html.kfm-track #track .mdc-typography--body2{padding:0!important}
html.kfm-track #track .tracking__block--meta .mdc-text-field{align-items:stretch!important;text-align:left!important}
html.kfm-track #track .tracking__block--meta .mdc-floating-label{text-align:left!important;align-self:flex-start;margin:0!important}
html.kfm-track #track .tracking__buttons .mdc-select{margin:0!important}
html.kfm-track #track .tracking__settings-mode{display:block!important}
html.kfm-track #track .tracking__settings-mode>div{width:100%!important}
#kfm-ovf{position:fixed;left:8px;right:8px;bottom:calc(70px + env(safe-area-inset-bottom));z-index:2147483646;max-height:50vh;overflow:auto;background:#fff;border:1px solid #ccc;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.2);padding:10px;font:12px/1.4 ui-monospace,Menlo,monospace;color:#222;white-space:pre-wrap;word-break:break-all}
#kfm-ovf button{font:600 13px -apple-system,sans-serif;margin:8px 8px 0 0;padding:6px 12px;border:1px solid #36c;border-radius:6px;background:#fff;color:#36c}
 #kfm-pager .kfm-pg-ctl{display:flex;align-items:center;gap:6px;flex:0 0 auto}
 #kfm-pager button{width:36px;height:36px;border-radius:50%;border:0;background:#f0f1f3;color:#222;font-size:17px;font-weight:600;line-height:36px;padding:0;cursor:pointer}
 #kfm-pager button:disabled{opacity:.35}
 #kfm-pager .kfm-pg-num{min-width:58px;text-align:center;font-size:14px;font-weight:700;color:#222;font-variant-numeric:tabular-nums}
 html.kfm body .knav-row{max-width:100vw!important;overflow-x:auto!important;box-sizing:border-box}
 #kfm-list{display:block;width:100%;max-width:100vw;box-sizing:border-box;padding:4px 8px 90px;font-size:15px;overflow-x:hidden;overflow-x:clip;position:relative;left:0;margin-left:0!important;margin-right:0!important;transform:none!important}
 #kfm-list .kfm-status{font-size:13px;color:#666;padding:4px 2px 8px}
 #kfm-list .kfm-c{background:#fff;border:1px solid #d6d9de;border-radius:12px;margin:0 0 8px;padding:12px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
 #kfm-list .kfm-h{display:flex;gap:10px;align-items:flex-start;margin-bottom:8px}
 #kfm-list .kfm-h img{width:96px;height:96px;flex:0 0 96px;object-fit:contain;border-radius:6px;background:#f7f7f7}
 #kfm-list .kfm-meta{flex:1 1 auto;min-width:0}
 #kfm-list .kfm-t{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;
   font-weight:700;font-size:15px;line-height:1.3;color:#222;text-decoration:none}
 #kfm-list .kfm-a{margin:4px 0;font-size:13px;color:#555}
 #kfm-list .kfm-l{display:flex;gap:6px;flex-wrap:wrap;margin:4px 0 0}
 #kfm-list .kfm-l a{padding:6px 10px;border:1px solid #36c;border-radius:6px;font-size:13px;color:#36c;text-decoration:none}
 #kfm-list .kfm-g{display:block;width:100%;height:140px;margin:0 0 8px;background:#fafbfc;border:1px solid #e1e4e8;border-radius:8px;overflow:hidden}
 #kfm-list .kfm-g img{width:100%;height:100%;object-fit:fill;display:block}
 #kfm-list .kfm-f{display:grid;grid-template-columns:1fr 1fr;gap:8px 10px}
 #kfm-list .kfm-f>div{min-width:0}
 #kfm-list .kfm-f span{display:block;font-size:12px;color:#888;margin-bottom:1px}
 #kfm-list .kfm-f b{display:block;font-size:17px;font-weight:700;line-height:1.25;overflow-wrap:anywhere}
 #kfm-list .kfm-c{position:relative;padding:0!important;overflow:hidden;background:#1a73e8!important}
 #kfm-list .kfm-inner{position:relative;background:#fff;padding:12px 12px 36px;border-radius:12px;touch-action:pan-y;z-index:1}
 #kfm-list .kfm-swiping .kfm-inner,#kfm-list .kfm-swopen .kfm-inner{will-change:transform}
 #kfm-list .kfm-swa{position:absolute;top:0;right:0;bottom:0;width:96px;border:0;background:#1a73e8;color:#fff;display:flex;flex-direction:column;
   align-items:center;justify-content:center;gap:4px;font-size:12px;font-weight:700;padding:0 6px;z-index:0;text-align:center;line-height:1.2}
 #kfm-list .kfm-sent{display:inline-block;margin-left:6px;padding:1px 6px;border-radius:8px;background:#e6f4ea;color:#1a7f37;font-size:11px;font-weight:700;vertical-align:middle}
 #kfm-ask{position:fixed;inset:0;z-index:2147483500;background:rgba(0,0,0,.4);display:flex;align-items:flex-end;justify-content:center}
#kfm-ask .kfm-ask-b{background:#fff;width:100%;max-width:520px;border-radius:16px 16px 0 0;padding:20px 16px calc(16px + env(safe-area-inset-bottom));box-sizing:border-box;font:16px/1.5 -apple-system,sans-serif;color:#222}
#kfm-ask .kfm-ask-t{font-weight:700;font-size:17px;margin-bottom:6px}
#kfm-ask .kfm-ask-s{color:#555;font-size:14px;margin-bottom:14px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
#kfm-ask .kfm-ask-r{display:flex;gap:10px}
#kfm-ask button{flex:1;height:48px;border-radius:12px;border:0;font-size:16px;font-weight:600;background:#eee;color:#222}
#kfm-ask button.kfm-ask-ok{background:#1a73e8;color:#fff}
#kfm-ask button.kfm-ask-ok.red{background:#d32f2f}
 #kfm-toast{position:fixed;left:50%;bottom:calc(140px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:2147483600;padding:10px 18px;
   border-radius:20px;color:#fff;font-size:14px;font-weight:700;opacity:0;transition:opacity .3s;pointer-events:none;box-shadow:0 2px 10px rgba(0,0,0,.2)}
 #kfm-toast.ok{background:#1a7f37} #kfm-toast.ng{background:#d32f2f} #kfm-toast.warn{background:#f0a000;color:#222}
 #kfm-list .kfm-c{display:block;width:100%!important;max-width:100%!important;min-width:0!important;box-sizing:border-box!important;overflow:hidden!important;overflow:clip!important;contain:paint;transform:none!important;left:auto!important;margin-left:0!important;margin-right:0!important}
#kfm-list .kfm-inner{width:100%;max-width:100%;box-sizing:border-box;left:0!important;margin:0!important}
#kfm-list .kfm-swacts{position:absolute;top:0;right:0;bottom:0;display:flex;z-index:0;max-width:100%;visibility:hidden;pointer-events:none}
#kfm-list .kfm-c.kfm-swiping .kfm-swacts,#kfm-list .kfm-c.kfm-swopen .kfm-swacts{visibility:visible;pointer-events:auto}
 #kfm-list .kfm-swacts .kfm-swa{position:static!important;flex:0 0 96px!important;width:96px!important;height:100%!important;margin:0!important;padding:0 4px!important;
   display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:6px!important;box-sizing:border-box!important}
 #kfm-list .kfm-swacts .kfm-swi{flex:0 0 24px;width:24px;height:24px;display:flex;align-items:center;justify-content:center}
 #kfm-list .kfm-swacts .kfm-swi svg{width:24px!important;height:24px!important;display:block}
 #kfm-list .kfm-swacts .kfm-swl{flex:0 0 32px;height:32px;width:100%;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;
   font-size:12px!important;font-weight:700;line-height:16px!important;text-align:center;white-space:nowrap;overflow:hidden}
 #kfm-list .kfm-swacts .kfm-swl span{display:block;font-size:inherit!important;line-height:inherit!important}
 #kfm-list .kfm-swdel{background:#d32f2f!important}
 #kfm-pager .kfm-pg-list{width:32px;height:32px;border-radius:50%;border:0;background:transparent;padding:0;margin-right:auto;display:inline-flex;align-items:center;justify-content:center}
 #kfm-sheet .kfm-set-mode{display:flex;gap:16px;flex-wrap:wrap;font-size:15px;padding:4px 0}
 #kfm-sheet .kfm-set-mode input{width:auto!important;min-height:0!important}
 #kfm-sheet .kfm-set-g{display:flex;flex-direction:column;gap:6px}
 #kfm-sheet .kfm-sh-q{margin:8px 12px;font-size:16px!important;padding:8px 10px;border:1px solid #ccc;border-radius:8px}
 #kfm-sheet .kfm-sh-link{font-size:14px;color:#1a73e8;align-self:center;text-decoration:none}
 #kfm-sheet .kfm-li{display:flex;align-items:flex-start;gap:10px}
 #kfm-sheet .kfm-li-th{flex:0 0 56px;width:56px;height:56px;object-fit:contain;border-radius:6px;background:#f5f5f5}
 #kfm-sheet .kfm-li-g{display:block;width:100%;height:auto;aspect-ratio:10/3;object-fit:contain;margin-top:6px;border:1px solid #eee;border-radius:6px;background:#fafbfc}
 #kfm-sheet .kfm-li-d{align-self:center}
 #kfm-sheet .kfm-set-chk{display:flex;align-items:center;gap:6px;font-size:15px!important;color:#333!important;margin-top:10px!important}
 #kfm-sheet .kfm-set-chk input{width:22px!important;height:22px!important}
 #kfm-sheet .kfm-li-i{flex:1 1 auto;min-width:0}
 #kfm-sheet .kfm-li-t{display:block;font-weight:600;color:#222;text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
 #kfm-sheet .kfm-li-m{font-size:12px;color:#777;margin-top:2px}
 #kfm-sheet .kfm-li-d{flex:0 0 auto;border:1px solid #d32f2f;color:#d32f2f;background:#fff;border-radius:16px;padding:6px 12px;font-size:13px}
 #kfm-sheet .kfm-set{display:flex;flex-direction:column;gap:6px;padding:14px}
 #kfm-sheet .kfm-set label{font-size:13px;color:#555;margin-top:6px}
 #kfm-sheet .kfm-set input{font-size:16px!important;padding:10px;border:1px solid #ccc;border-radius:8px;width:100%;box-sizing:border-box}
 #kfm-sheet .kfm-set-save{margin-top:12px;padding:12px;border:0;border-radius:10px;background:#1a73e8;color:#fff;font-size:16px;font-weight:700}
 #kfm-sheet .kfm-set-note{font-size:11px;color:#888;margin-top:6px}
 #kfm-sheet .kfm-set-ver{font-size:10px;color:#bbb;margin-top:8px;text-align:right}
 #kfm-pager .kfm-pg-set{width:32px;height:32px;border-radius:50%;border:0;background:transparent;color:#888;padding:0;margin-left:4px;display:inline-flex;align-items:center;justify-content:center}
 #kfm-pager button svg{display:block}
/* v0.1.3: 利き手に合わせてページ送りを片側にまとめる */
 #kfm-pager{gap:6px;padding-left:10px;padding-right:10px}
 #kfm-pager .kfm-pg-info{flex:0 1 auto;overflow:hidden}
 #kfm-pager .kfm-pg-info>span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 #kfm-pager .kfm-pg-set,#kfm-pager .kfm-pg-trk,#kfm-pager .kfm-pg-list{flex:0 0 auto;margin-left:0;margin-right:0}
 #kfm-pager .kfm-pg-ctl{gap:4px;margin-left:auto}
 #kfm-pager .kfm-pg-ctl button{width:44px;height:44px;line-height:44px;font-size:20px;flex:0 0 auto}
 #kfm-pager .kfm-pg-num{min-width:0;padding:0 2px;font-size:12px;color:#555}
 #kfm-pager .kfm-pg-num:empty{display:none}
 #kfm-pager.kfm-hand-left{flex-direction:row-reverse}
 #kfm-pager{gap:4px;padding-left:8px;padding-right:8px}
 #kfm-pager .kfm-pg-ver,#kfm-pager .kfm-pg-num{display:none!important}
 #kfm-pager .kfm-pg-info{flex:1 1 64px;min-width:0;overflow:hidden}
 #kfm-pager .kfm-pg-info>span{overflow:visible;text-overflow:clip}
 #kfm-pager .kfm-pg-sum{display:flex;flex-direction:column;font-size:12px;line-height:1.25;color:#555;font-variant-numeric:tabular-nums}
 #kfm-pager .kfm-pg-set,#kfm-pager .kfm-pg-trk,#kfm-pager .kfm-pg-list{width:30px;height:30px}
 #kfm-pager .kfm-pg-ctl{gap:2px}
 #kfm-pager .kfm-pg-icons{display:flex;align-items:center;gap:0;flex:0 0 auto;flex-direction:row!important;margin:0 4px 0 0}
 #kfm-pager.kfm-hand-left .kfm-pg-icons{margin:0 0 0 4px}
 #kfm-pager .kfm-pg-icons>button{box-sizing:border-box!important;width:32px!important;height:32px!important;min-width:32px!important;padding:0!important;margin:0!important;border:0!important;border-radius:50%;background:transparent!important;color:#888!important;display:inline-flex!important;align-items:center;justify-content:center;flex:0 0 32px}
 #kfm-pager .kfm-pg-icons svg{width:18px!important;height:18px!important;display:block;flex:0 0 18px}
 #kfm-pager .kfm-pg-ctl{margin-left:0}
 #kfm-pager.kfm-hand-left .kfm-pg-ctl{margin-right:0}
 #kfm-pager .kfm-pg-info{margin-right:auto}
 #kfm-pager.kfm-hand-left .kfm-pg-info{margin-right:0;margin-left:auto}
/* v0.1.16: より強い Liquid Glass（本体に blur）+ 件数/アイコン/矢印を space-between で均等配置 */
 #kfm-pager{position:fixed;left:8px!important;right:8px!important;width:auto!important;max-width:calc(100vw - 16px)!important;
   border-radius:999px;padding:6px 12px!important;min-height:60px;
   gap:0!important;box-sizing:border-box!important;overflow:visible!important;
   border:1px solid rgba(255,255,255,.6)!important;
   background:linear-gradient(165deg,rgba(255,255,255,.34) 0%,rgba(255,255,255,.28) 45%,rgba(255,255,255,.30) 100%)!important;
   -webkit-backdrop-filter:blur(28px) saturate(200%) brightness(1.08)!important;
   backdrop-filter:blur(28px) saturate(200%) brightness(1.08)!important;
   -webkit-box-shadow:inset 0 1.5px 0 rgba(255,255,255,.95),inset 0 -1px 0 rgba(15,25,45,.10),inset 0 0 20px rgba(255,255,255,.22),
     0 10px 28px rgba(20,30,60,.20),0 2px 6px rgba(0,0,0,.10)!important;
   box-shadow:inset 0 1.5px 0 rgba(255,255,255,.95),inset 0 -1px 0 rgba(15,25,45,.10),inset 0 0 20px rgba(255,255,255,.22),
     0 10px 28px rgba(20,30,60,.20),0 2px 6px rgba(0,0,0,.10)!important;
   transform:none!important;-webkit-transform:none!important;z-index:9998;
   display:flex!important;align-items:center!important;justify-content:space-between!important;
   isolation:isolate}
 #kfm-pager::after{content:'';position:absolute;inset:0;border-radius:inherit;z-index:-1;pointer-events:none;
   background:transparent!important;border:0!important;
   -webkit-backdrop-filter:none!important;backdrop-filter:none!important;box-shadow:none!important}
 #kfm-pager::before{content:'';position:absolute;left:12%;right:12%;top:1px;height:38%;border-radius:999px;z-index:0;pointer-events:none;
   background:linear-gradient(180deg,rgba(255,255,255,.50),rgba(255,255,255,0))!important;
   opacity:.7;display:block!important}
 #kfm-pager button:focus,#kfm-pager button:focus-visible,#kfm-pager button:active{
   outline:none!important;box-shadow:inset 0 1px 0 #fff,inset 0 0 0 .5px rgba(255,255,255,.8),0 2px 6px rgba(20,30,60,.15)!important;
   -webkit-tap-highlight-color:transparent}
 #kfm-pager .kfm-pg-icons>button:focus,#kfm-pager .kfm-pg-icons>button:focus-visible,#kfm-pager .kfm-pg-icons>button:active{
   outline:none!important;box-shadow:none!important;background:transparent!important}
 #kfm-pager.kfm-pg-solo{padding-bottom:6px!important}
 #kfm-pager.kfm-hand-left{padding:6px 12px!important}
 /* 3グループ均等: 件数 | アイコン | 矢印（左手は row-reverse でも space-between が効く） */
 #kfm-pager .kfm-pg-info{flex:0 1 auto!important;min-width:0!important;max-width:42%!important;overflow:hidden!important;
   box-sizing:border-box!important;margin:0!important;position:relative;z-index:1}
 #kfm-pager .kfm-pg-icons{margin:0!important;gap:0!important;flex:0 0 auto!important;flex-shrink:0!important;position:relative;z-index:1}
 #kfm-pager.kfm-hand-left .kfm-pg-icons{margin:0!important}
 #kfm-pager .kfm-pg-ctl{gap:0!important;flex:0 0 auto!important;flex-shrink:0!important;margin:0!important;position:relative;z-index:1}
 #kfm-pager.kfm-hand-left .kfm-pg-ctl{margin:0!important}
 #kfm-pager .kfm-pg-sum{display:flex!important;flex-direction:column!important;white-space:normal!important;overflow:hidden!important;text-overflow:clip;min-width:0;max-width:100%;color:#222;box-sizing:border-box;
   text-shadow:0 0 6px rgba(255,255,255,.95),0 1px 0 rgba(255,255,255,.8)}
 #kfm-pager .kfm-pg-sum>span{display:block!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:clip!important;max-width:100%}
 #kfm-pager .kfm-pg-sum>span:first-child{font-weight:700;color:#111}
 #kfm-pager .kfm-pg-icons>button{color:#333!important;filter:drop-shadow(0 0 3px rgba(255,255,255,.9))}
 #kfm-pager .kfm-pg-ctl button{width:44px;height:44px;border-radius:50%;color:#1c1c1e;font-weight:600;flex:0 0 44px;box-sizing:border-box;
   border:1px solid rgba(255,255,255,.55)!important;
   background:linear-gradient(180deg,rgba(255,255,255,.40),rgba(255,255,255,.18))!important;
   -webkit-backdrop-filter:blur(18px) saturate(200%) brightness(1.06)!important;
   backdrop-filter:blur(18px) saturate(200%) brightness(1.06)!important;
   -webkit-box-shadow:inset 0 1px 0 rgba(255,255,255,.95),inset 0 -1px 0 rgba(15,25,45,.10),0 2px 8px rgba(20,30,60,.16);
   box-shadow:inset 0 1px 0 rgba(255,255,255,.95),inset 0 -1px 0 rgba(15,25,45,.10),0 2px 8px rgba(20,30,60,.16)}
 #kfm-pager .kfm-pg-ctl button:disabled{opacity:.35;box-shadow:inset 0 0 0 .5px rgba(255,255,255,.5)}
 @supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){
   #kfm-pager{background:rgba(255,255,255,.82)!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important}
   #kfm-pager::before{opacity:.4}
   #kfm-pager .kfm-pg-ctl button{background:rgba(255,255,255,.88)!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;
     box-shadow:0 0 0 1px rgba(255,255,255,.7),0 2px 6px rgba(20,30,60,.12)}}
 #kfm-pager .kfm-pg-ctl,#kfm-pager .kfm-pg-icons{flex-shrink:0!important}
 html.kfm-restoring #kfm-list>*{visibility:hidden}
 html.kfm-restoring #kfm-list{min-height:60vh;position:relative}
 html.kfm-restoring #kfm-list::before{content:'前の位置に戻しています…';position:absolute;left:0;right:0;top:40px;text-align:center;color:#888;font-size:14px;visibility:visible}
 html.kfm-restoring #kfm-pager .kfm-pg-sum{visibility:hidden}
 #kfm-pager.kfm-hand-left .kfm-pg-ctl{margin:0!important}
 #kfm-pager.kfm-hand-left .kfm-pg-info{text-align:right;align-items:flex-end;margin:0!important}
 #kfm-sheet .kfm-set-hand{display:flex;align-items:center;gap:16px;font-size:15px;padding:4px 0}
 #kfm-sheet .kfm-set-hand>b{font-weight:600;color:#333}
 #kfm-list .kfm-all{display:none;margin-top:10px;padding-top:8px;border-top:1px dashed #ddd}
 #kfm-list .kfm-c.kfm-x .kfm-all{display:block}
 #kfm-list .kfm-gs{margin:0 0 8px}
 #kfm-list .kfm-gh{background:#f2f3f5;border-radius:4px;padding:4px 8px;font-size:12px;font-weight:700;color:#333;margin-bottom:2px}
 #kfm-list .kfm-gr{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:6px 8px;border-bottom:1px solid #eee}
 #kfm-list .kfm-gr:last-child{border-bottom:0}
 #kfm-list .kfm-gl{font-size:13px;color:#666;flex:1 1 auto;min-width:0}
 #kfm-list .kfm-gv{font-size:14px;font-weight:600;color:#222;text-align:right;font-variant-numeric:tabular-nums;max-width:60%;overflow-wrap:anywhere}
 #kfm-list .kfm-gv.kfm-long{font-size:13px;font-weight:400}
 #kfm-list .kfm-gv.kfm-empty{color:#bbb;font-weight:400}
 #kfm-list .kfm-tg{position:absolute;right:6px;bottom:4px;min-width:36px;min-height:32px;padding:0 8px;border:0;background:transparent;
   font-size:20px;color:#36c;line-height:32px;cursor:pointer}
 #kfm-list .kfm-top{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin:0 0 8px}
 #kfm-list .kfm-stat{background:#f3f7ff;border:1px solid #d9e4ff;border-radius:8px;padding:6px;min-width:0;text-align:center}
 #kfm-list .kfm-stat span{display:block;font-size:11px;color:#557;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 #kfm-list .kfm-stat b{display:block;font-size:18px;font-weight:800;line-height:1.2;overflow-wrap:anywhere}
 #kfm-list .kfm-cp{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;margin-left:2px;padding:0;border:0;background:transparent;vertical-align:middle;cursor:pointer;-webkit-tap-highlight-color:transparent}
 #kfm-list .kfm-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:4px;vertical-align:middle}
 #kfm-list .kfm-sub{display:block;font-size:11px;font-weight:600}
 #kfm-list .kfm-be{margin:0 0 8px}
 #kfm-list .kfm-be-n{font-size:17px;font-weight:800;color:#2e9e2e}
 #kfm-list .kfm-be-d{font-size:12px;color:#888;margin-top:1px}
 #kfm-list .kfm-note{display:block;font-size:11px;font-weight:400;color:#999!important;line-height:1.3;margin-top:1px}
 #kfm-list .kfm-more{text-align:center;font-size:12px;color:#36c;padding-top:8px}
 /* filters */
 html.kfm.kfm-finder body .filter-row{display:block!important;width:100%!important;max-width:100%!important;padding:6px 4px!important;box-sizing:border-box;position:relative!important}
 html.kfm.kfm-finder body .filter-row .filter--reset,html.kfm.kfm-finder body .filter-row [class*="reset"],
 html.kfm.kfm-finder body .filter-row button[title*="リセット"],html.kfm.kfm-finder body .filter-row a[title*="リセット"]{
   display:block!important;width:100%!important;max-width:100%!important;float:none!important;clear:both!important;
   position:static!important;text-align:right!important;margin:0 0 2px!important;padding:0!important;line-height:1.2!important;min-height:0!important;height:auto!important;
   box-sizing:border-box!important;flex:0 0 100%!important}
 html.kfm.kfm-finder body .filter-row .filter-range,html.kfm.kfm-finder body .filter-row .filter-range.narrow,
 html.kfm.kfm-finder body .filter-row .filter-range--seg,html.kfm.kfm-finder body .filter-row .filter-range--field,
 html.kfm.kfm-finder body .filter-row .filter-range--input,html.kfm.kfm-finder body .filter-row .filter-input,
 html.kfm.kfm-finder body .filter-row .filter-text{width:100%!important;max-width:100%!important;flex:1 1 100%!important;float:none!important;box-sizing:border-box!important}
 html.kfm.kfm-finder body .filter-row .filter-range--field{flex:1 1 45%!important;width:auto!important;min-width:0!important;max-width:none!important}
 html.kfm.kfm-finder body .filter-row--label{display:block!important;width:100%!important;font-weight:600;margin:4px 0}
 /* v0.1.23: Keepa の label-extended は横並び+min-width でチェックが折り返す。見出し内は縦一列に固定 */
 html.kfm.kfm-finder body .filter-row--label-extended{display:flex!important;flex-direction:column!important;flex-wrap:nowrap!important;
   align-items:stretch!important;gap:8px!important;width:100%!important;font-weight:600;margin:4px 0}
 html.kfm.kfm-finder body .filter-range,html.kfm.kfm-finder body .filter-range.narrow{display:block!important;width:100%!important;margin:4px 0!important;float:none!important}
 html.kfm.kfm-finder body .filter-range--seg{display:flex!important;flex-wrap:wrap;align-items:center;gap:6px;width:100%!important;margin:3px 0}
 html.kfm.kfm-finder body .filter-range--seg-label,html.kfm.kfm-finder body .filter-range--label{display:block!important;width:100%!important;font-size:12px;color:#555}
 html.kfm.kfm-finder body .filter-range--field{flex:1 1 45%!important;width:auto!important;min-width:0}
 html.kfm.kfm-finder body .filter-range--input,html.kfm.kfm-finder body .filter-input,html.kfm.kfm-finder body .filter-input--field,
 html.kfm.kfm-finder body .filter-text input,html.kfm.kfm-finder body select{width:100%!important;font-size:16px!important;min-height:40px;box-sizing:border-box}
 html.kfm.kfm-finder body .filter-text,html.kfm.kfm-finder body .filter-values,html.kfm.kfm-finder body .filter-input{display:block!important;width:100%!important}
 
 html.kfm.kfm-finder body .filter--reset{min-width:0;min-height:0;height:auto}
 /* date fields match numeric range look */
 html.kfm.kfm-finder body .filter-range--field.-date,html.kfm.kfm-finder body .filter-range--field[class*="-date"], html.kfm.kfm-finder body .kfm-datefix,
 html.kfm.kfm-finder body .filter-range--field.-date .filter-range--input,html.kfm.kfm-finder body .filter-range--field[class*="-date"] input, html.kfm.kfm-finder body .kfm-datefix .filter-range--input,
 html.kfm.kfm-finder body input[type=date],html.kfm.kfm-finder body input[type=datetime-local]{
   position:relative!important;display:flex!important;align-items:center!important;min-height:40px!important;height:40px!important;
   font-size:16px!important;line-height:40px!important;box-sizing:border-box!important;padding:0 10px!important;
   border:1px solid #ccc!important;border-radius:4px!important;background:#fff!important;color:#333!important;
   -webkit-appearance:none!important;appearance:none!important}
 html.kfm.kfm-finder body .filter-range--field.-date,html.kfm.kfm-finder body .filter-range--field[class*="-date"], html.kfm.kfm-finder body .kfm-datefix{
   display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:6px;padding:0!important;border:0!important;background:transparent!important;height:auto!important}
 html.kfm.kfm-finder body .filter-range--field.-date .filter-range--label, html.kfm.kfm-finder body .kfm-datefix .filter-range--label,
 html.kfm.kfm-finder body .filter-range--field[class*="-date"] .filter-range--label,
 html.kfm.kfm-finder body .filter-range--field.-date .filter-range--seg-label, html.kfm.kfm-finder body .kfm-datefix .filter-range--seg-label,
 html.kfm.kfm-finder body .filter-range--field[class*="-date"] .filter-range--seg-label,
 html.kfm.kfm-finder body .filter-range--field.-date>span,html.kfm.kfm-finder body .filter-range--field[class*="-date"]>span, html.kfm.kfm-finder body .kfm-datefix>span,
 html.kfm.kfm-finder body .filter-range--field.-date>label,html.kfm.kfm-finder body .filter-range--field[class*="-date"]>label, html.kfm.kfm-finder body .kfm-datefix>label{
   position:absolute!important;right:10px!important;left:auto!important;top:50%!important;transform:translateY(-50%)!important;
   margin:0!important;padding:0!important;font-size:16px!important;line-height:1!important;color:#999!important;
   pointer-events:none!important;white-space:nowrap!important;width:auto!important;text-align:right!important;z-index:1}
 html.kfm.kfm-finder body .filter-range--field.-date input::placeholder, html.kfm.kfm-finder body .kfm-datefix input::placeholder,
 html.kfm.kfm-finder body .filter-range--field[class*="-date"] input::placeholder,
 html.kfm.kfm-finder body input[type=date]:invalid,html.kfm.kfm-finder body input[type=date]:placeholder-shown{
   color:#999!important;text-align:right!important;font-size:16px!important}
 html.kfm.kfm-finder body .filter-range--field.-date input,html.kfm.kfm-finder body .filter-range--field[class*="-date"] input, html.kfm.kfm-finder body .kfm-datefix input{
   flex:1 1 auto!important;width:100%!important;text-align:left!important;padding-right:3em!important}
 html.kfm.kfm-finder body .kfm-datefix{position:relative!important}
 html.kfm.kfm-finder body .kfm-fromto{position:absolute!important;right:10px!important;left:auto!important;top:50%!important;transform:translateY(-50%)!important;
   margin:0!important;padding:0!important;font-size:16px!important;line-height:1!important;color:#999!important;pointer-events:none!important;
   white-space:nowrap!important;width:auto!important;z-index:1}
 /* hide empty gap wrappers after reset */
 html.kfm.kfm-finder body .filter-row .filter--reset+*,html.kfm.kfm-finder body .filter-row [class*="reset"]+*{
   margin-top:0!important}
 html.kfm.kfm-finder body .filter-row>.filter--reset,html.kfm.kfm-finder body .kfm-emptied+*{margin-top:0!important}
 html.kfm.kfm-finder body .colorTip,html.kfm.kfm-finder body .pointyTip{max-width:90vw!important;white-space:normal!important}
 html.kfm body .kfm-toggle{display:block;width:100%;text-align:left;padding:12px 10px;margin:8px 0 4px;font-size:16px;font-weight:700;
   background:#f2f4f7;border:1px solid #ccd;border-radius:8px;color:#222}
 html.kfm body .kfm-collapsed>*:not(.kfm-toggle){display:none!important}
 html.kfm body .kfm-bottombar{position:fixed!important;left:0;right:0;bottom:0;z-index:9999;display:flex!important;flex-wrap:wrap!important;
   overflow-x:hidden!important;gap:6px;padding:8px 8px calc(8px + env(safe-area-inset-bottom));background:#fff!important;
   border-top:1px solid #ccc;border-radius:10px 10px 0 0;box-sizing:border-box;width:100%!important;max-width:100vw!important;justify-content:stretch}
 html.kfm body .kfm-bottombar>*{flex:1 1 auto;font-size:12px;min-width:0;max-width:100%;box-sizing:border-box}
 html.kfm body .kfm-search{flex:1 1 100%!important;font-size:15px!important;font-weight:700;min-height:44px;width:100%!important;order:99}
 html.kfm.kfm-finder body{padding-bottom:80px!important}
 html.kfm{-webkit-text-size-adjust:100%}
 html.kfm body{min-width:0!important;width:auto!important}
 html.kfm #topPanel,html.kfm #wrapper,html.kfm .mainContent,html.kfm [id*="finder" i],html.kfm [class*="finder" i],
 html.kfm .knav-row,html.kfm .filter-row,html.kfm .filter-range,html.kfm .filter-text,html.kfm .filter-values,
 html.kfm .ag-root-wrapper,html.kfm [class*="ag-theme"],html.kfm .kfm-bottombar,html.kfm .kfm-toolbar,html.kfm .kfm-section{width:auto!important;max-width:100%!important;min-width:0!important;box-sizing:border-box!important}
 html.kfm.kfm-finder .filter-row table{max-width:100%!important;table-layout:auto}
 html.kfm .filter-values,html.kfm .filter-boolean,html.kfm .kfm-checks{display:flex!important;flex-wrap:wrap!important;gap:8px 16px!important;align-items:center}
 html.kfm .filter--checkbox,html.kfm .panelCheck,html.kfm .kfm-checkpair{display:inline-flex!important;align-items:center!important;gap:6px;
   white-space:nowrap!important;writing-mode:horizontal-tb!important;width:auto!important;min-width:max-content!important;word-break:normal!important;margin:0!important}
 html.kfm .filter--checkbox *,html.kfm .panelCheck *,html.kfm label{word-break:normal!important;writing-mode:horizontal-tb!important}
 html.kfm input[type=checkbox],html.kfm input[type=radio]{width:auto!important;min-width:20px!important;min-height:20px!important;flex:0 0 auto}
 html.kfm input,html.kfm select,html.kfm textarea{max-width:100%!important;min-width:0!important}
 html.kfm.kfm-finder .filter-row input:not([type=checkbox]):not([type=radio]),html.kfm.kfm-finder .filter-row select{width:100%!important}
 html.kfm img,html.kfm svg,html.kfm canvas{max-width:100%!important}
 html.kfm .knav-row,html.kfm .filter-range--seg{flex-wrap:wrap!important}
 html.kfm .kfm-bottombar{flex-wrap:wrap!important;overflow-x:hidden!important}
 /* v0.1.9: カテゴリチップの × を押しやすく */
 html.kfm .filter-values>span{display:inline-flex!important;align-items:center;gap:2px;margin:2px 4px 2px 0!important;padding:4px 4px 4px 8px!important;border:1px solid #d0d5dd;border-radius:14px;background:#f5f7fa;font-size:13px;line-height:1.2;max-width:100%;box-sizing:border-box}
 html.kfm .filter-values>span.clear-all{border-style:dashed;color:#666}
 html.kfm .filter-values>span>i[data-id],html.kfm .filter-values i[data-id],
 html.kfm .finder-pill--remove,html.kfm .finder-pill .fa-times{
   display:inline-flex!important;align-items:center;justify-content:center;flex:0 0 32px;width:32px!important;height:32px!important;min-width:32px!important;min-height:32px!important;
   margin:0!important;padding:0!important;font-size:16px!important;line-height:32px!important;border-radius:50%;color:#444;cursor:pointer;-webkit-tap-highlight-color:transparent}
 html.kfm .filter-values i[data-id]::before,html.kfm .finder-pill--remove .fa-times::before{font-size:16px!important}
 /* チップ行が浮きバーに隠れないよう余白 */
 html.kfm.kfm-finder .grid-filter-form,html.kfm.kfm-finder #grid-form-finder{padding-bottom:calc(120px + env(safe-area-inset-bottom))!important}
 html.kfm.kfm-finder #grid-form-finder:empty{padding:0!important;min-height:0!important}
 html.kfm.kfm-finder .filter-text--autocomplete .filter-values{margin-bottom:12px!important;padding-bottom:8px!important}
 html.kfm.kfm-finder .finder-pills{padding-bottom:8px!important;margin-bottom:8px!important}
 /* 下バー: リセット・件数・探すが重ならない */
 html.kfm body .filter-actions.kfm-bottombar,html.kfm body .kfm-bottombar.filter-actions{
   display:flex!important;flex-wrap:wrap!important;align-items:center!important;gap:8px!important;row-gap:8px!important;
   background:#fff!important;border-radius:10px 10px 0 0!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important}
 html.kfm body .filter-actions__trailing{display:flex!important;flex-wrap:wrap!important;align-items:center!important;gap:8px!important;
   flex:1 1 100%!important;width:100%!important;min-width:0!important;margin:0!important;position:static!important;order:99!important}
 html.kfm body .filter-actions__trailing .filter--reset,html.kfm body .filter-actions__trailing .filter-form--reset{
   display:block!important;position:static!important;flex:1 1 auto!important;min-width:0!important;margin:0!important}
 html.kfm body .filter-actions__trailing .filter-actions__action.-destructive{width:auto!important;max-width:100%!important;white-space:nowrap}
 html.kfm body #totalResultsQuery{position:static!important;display:inline-flex!important;align-items:center;flex:0 0 auto!important;
   margin:0!important;padding:6px 10px!important;border-radius:14px;background:#e8f0fe;color:#1a73e8;font-weight:700;font-size:13px;line-height:1.2;
   float:none!important;transform:none!important}
 /* v0.1.20: Keepa が件数を隠しているとき（条件なし・読み込み中）や中身が空のときは、空の青い丸を出さない */
 html.kfm body #totalResultsQuery[style*="display: none"],html.kfm body #totalResultsQuery[style*="display:none"],html.kfm body #totalResultsQuery:empty,
 html.kfm body #totalResultsQuery:has(.filter-count__figure:empty),html.kfm body #totalResultsQuery:not(:has(.filter-count__figure)){display:none!important}
 html.kfm body #filterSubmit.kfm-search,html.kfm body .filter-actions__trailing #filterSubmit{
   flex:1 1 100%!important;width:100%!important;order:99;margin:0!important}
 /* v0.1.15: フィルターへジャンプを単独行に。ビルダーは次行で概要などと並べ、下線がピルに食い込まないように */
 html.kfm body .filter-actions.kfm-bottombar .tool__jumpfilter{
   flex:1 1 100%!important;width:100%!important;max-width:100%!important;min-width:0!important;
   display:flex!important;align-items:center!important;gap:6px!important;box-sizing:border-box!important;
   margin:0!important;order:0}
 html.kfm body .filter-actions.kfm-bottombar .tool__jumpfilter .filter-jump,
 html.kfm body .filter-actions.kfm-bottombar input.filter-jump{
   flex:1 1 auto!important;width:100%!important;max-width:100%!important;min-width:0!important;
   box-sizing:border-box!important;display:block!important}
 html.kfm body .filter-actions.kfm-bottombar .filter-actions__gap{display:none!important;width:0!important;flex:0 0 0!important;margin:0!important;padding:0!important}
 html.kfm body .filter-actions.kfm-bottombar .filter-layout{
   flex:0 1 auto!important;width:auto!important;max-width:100%!important;min-width:0!important;order:1}
 html.kfm body .filter-actions.kfm-bottombar .filter-layout .filter-actions__action,
 html.kfm body .filter-actions.kfm-bottombar #filterLayoutToggle{
   white-space:nowrap!important;max-width:100%!important}
 html.kfm body .filter-actions.kfm-bottombar #filterAbout,
 html.kfm body .filter-actions.kfm-bottombar .tool__filterinfo,
 html.kfm body .filter-actions.kfm-bottombar > span:not(.tool__jumpfilter):not(.filter-actions__gap):not(.filter-actions__trailing){
   flex:0 1 auto!important;order:1!important}
 html.kfm body .filter-actions.kfm-bottombar .filter-layout{order:1!important}
 html.kfm input,html.kfm select,html.kfm textarea{font-size:16px!important;-webkit-text-size-adjust:100%}
 html.kfm .filter-row,html.kfm .filter-range,html.kfm .filter-text,html.kfm .filter-input{zoom:1!important;transform:none!important}
 html.kfm .filter-row .filter-row--label{display:block!important;width:100%!important;
   flex:0 0 100%!important;grid-column:1/-1!important;float:none!important;margin:0 0 6px!important;white-space:normal!important}
 html.kfm .filter-row .filter-row--label-extended{display:flex!important;flex-direction:column!important;flex-wrap:nowrap!important;
   align-items:stretch!important;gap:8px!important;width:100%!important;flex:0 0 100%!important;grid-column:1/-1!important;
   float:none!important;margin:0 0 6px!important;white-space:normal!important}
 html.kfm .filter-row .filter-row--label-extended>span:first-child,
 html.kfm .filter-row .filter-row--label-extended span.filter--checkbox,
 html.kfm .filter-row .filter-row--label-extended .filter--reset,
 html.kfm .filter-row .filter-row--label-extended .kfm-vlist{flex:0 0 auto!important;min-width:0!important;width:100%!important;
   max-width:100%!important;margin-left:0!important;box-sizing:border-box!important}
 html.kfm .filter-row .filter-row--label-extended span.filter--checkbox,
 html.kfm .filter-row .filter-row--label-extended .panelCheck{display:flex!important;align-items:center!important;
   white-space:normal!important;min-width:0!important}
 html.kfm .filter-row .kfm-checks,html.kfm .filter-row .filter-values,html.kfm .filter-row .filter-boolean{display:grid!important;
   grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px 12px!important;width:100%!important;align-items:center}
 html.kfm .filter-row .kfm-checks>.filter-row--label,html.kfm .filter-row .kfm-checks>.filter-row--label-extended{grid-column:1/-1!important}
 html.kfm .filter-row .filter--checkbox,html.kfm .filter-row .panelCheck,html.kfm .filter-row .kfm-checkpair{display:inline-flex!important;
   align-items:center!important;gap:6px!important;white-space:normal!important;min-width:0!important;width:auto!important;float:none!important}
 html.kfm .filter-row input[type=checkbox]{width:22px!important;height:22px!important;min-width:22px!important;flex-shrink:0!important;margin:0!important}
 html.kfm .kfm-vlist{display:flex!important;flex-direction:column!important;gap:10px!important;margin:8px 0 12px!important;width:100%!important;clear:both}
 html.kfm .kfm-vlist>*{display:flex!important;align-items:center!important;gap:8px!important;width:100%!important;margin:0!important;
   float:none!important;position:static!important;white-space:normal!important;font-size:15px!important;min-width:0!important}
 html.kfm .kfm-vlist input[type=checkbox]{width:22px!important;height:22px!important;min-width:22px!important;flex-shrink:0!important;margin:0!important}
 html.kfm .kfm-rowlabel{display:block!important;width:100%!important;float:none!important}
 html.kfm .kfm-emptied{display:none!important}
 /* jQuery UI autocomplete: minimal */
 html.kfm .filter-text--autocomplete,html.kfm .ui-front{overflow:visible!important}
 html.kfm ul.ui-autocomplete{z-index:2147483647!important;background:#fff}
 /* product page (#!product): no layout surgery — native PC layout, scaled by viewport width */
 html.kfm.kfm-product,html.kfm.kfm-product body{max-width:none!important;width:auto!important;overflow:visible!important}
 html.kfm.kfm-product #topPanel,html.kfm.kfm-product #wrapper,html.kfm.kfm-product .mainContent,html.kfm.kfm-product .knav-row{max-width:none!important}
 html.kfm.kfm-product .kfm-gridhost,html.kfm.kfm-product #kfm-list{display:none!important}

 /* v0.1.9: 列を設定 — ネイティブは常に画面外、シートで操作 */
 html.kfm .content-column,html.kfm .content-column *{word-break:normal!important}
 html.kfm .content-column{position:fixed!important;left:-9999px!important;top:0!important;width:1px!important;height:1px!important;
   overflow:hidden!important;opacity:0!important;pointer-events:none!important;z-index:-1!important}
 #kfm-cols{position:fixed;inset:0;z-index:2147483400;background:rgba(0,0,0,.4);display:flex;align-items:flex-end;font:15px/1.4 -apple-system,system-ui,"Hiragino Sans",sans-serif}
 #kfm-cols .kfm-cols-sh{background:#fff;width:100%;height:92vh;max-height:92vh;border-radius:16px 16px 0 0;display:flex;flex-direction:column;padding-bottom:env(safe-area-inset-bottom);box-sizing:border-box}
 #kfm-cols .kfm-cols-top{display:flex;align-items:center;gap:8px;padding:12px 12px 8px;border-bottom:1px solid #eee;flex:0 0 auto}
 #kfm-cols .kfm-cols-top b{flex:1 1 auto;font-size:16px}
 #kfm-cols .kfm-cols-top button{border:1px solid #ccc;background:#f5f6f8;border-radius:16px;padding:8px 12px;font-size:14px;min-height:40px}
 #kfm-cols .kfm-cols-top .kfm-cols-done{background:#1a73e8;border-color:#1a73e8;color:#fff;font-weight:700}
 #kfm-cols .kfm-cols-tools{display:flex;flex-wrap:wrap;gap:6px;padding:8px 12px;border-bottom:1px solid #f0f0f0;flex:0 0 auto;align-items:center}
 #kfm-cols .kfm-cols-tools input[type=search]{flex:1 1 120px;min-width:0;font-size:16px!important;padding:10px 12px;border:1px solid #ccc;border-radius:10px}
 #kfm-cols .kfm-cols-tools label{display:inline-flex;align-items:center;gap:4px;font-size:12px;color:#555;white-space:nowrap;flex:0 0 auto}
 #kfm-cols .kfm-cols-tools button{border:1px solid #ddd;background:#fff;border-radius:12px;padding:6px 8px;font-size:12px;min-height:36px;color:#333;flex:0 0 auto;white-space:nowrap}
 #kfm-cols .kfm-cols-body{flex:1 1 auto;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:0 0 12px}
 #kfm-cols .kfm-cols-g{border-bottom:1px solid #eee}
 #kfm-cols .kfm-cols-gh{display:flex;align-items:center;gap:10px;width:100%;padding:12px 14px;border:0;background:#fafbfc;text-align:left;font-size:15px;font-weight:700;color:#222;min-height:48px;box-sizing:border-box}
 #kfm-cols .kfm-cols-gh .kfm-cols-caret{flex:0 0 18px;color:#888;font-size:12px}
 #kfm-cols .kfm-cols-gh .kfm-cols-gname{flex:1 1 auto;min-width:0}
 #kfm-cols .kfm-cols-gh .kfm-cols-gcount{flex:0 0 auto;font-size:12px;font-weight:600;color:#888}
 #kfm-cols .kfm-cols-gall{flex:0 0 auto;border:1px solid #ccc;background:#fff;border-radius:12px;padding:6px 8px;font-size:12px;color:#1a73e8;min-height:36px}
 #kfm-cols .kfm-cols-g.kfm-cols-collapsed .kfm-cols-gi{display:none}
 #kfm-cols .kfm-cols-gi{display:flex;align-items:center;gap:12px;padding:12px 14px 12px 18px;border-top:1px solid #f3f3f3;min-height:48px;box-sizing:border-box;background:#fff}
 #kfm-cols .kfm-cols-gi.kfm-cols-on{background:#eef5ff}
 #kfm-cols .kfm-cols-gi.kfm-cols-off{opacity:.55}
 #kfm-cols .kfm-cols-sw{flex:0 0 48px;width:48px;height:30px;border-radius:15px;border:0;background:#c8ccd2;position:relative;padding:0}
 #kfm-cols .kfm-cols-sw::after{content:'';position:absolute;top:3px;left:3px;width:24px;height:24px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:left .15s}
 #kfm-cols .kfm-cols-gi.kfm-cols-on .kfm-cols-sw{background:#1a73e8}
 #kfm-cols .kfm-cols-gi.kfm-cols-on .kfm-cols-sw::after{left:21px}
 #kfm-cols .kfm-cols-lab{flex:1 1 auto;min-width:0;font-size:15px;color:#222}
 #kfm-cols .kfm-cols-empty{padding:24px 16px;text-align:center;color:#888}
 /* v0.1.9: 複数選択オートコンプリートをシート化（最初からスタイル適用） */
 html.kfm.kfm-ac-open #kfm-pager{visibility:hidden!important;pointer-events:none!important}
 html.kfm ul.ui-autocomplete{z-index:2147483500!important;background:#fff!important;border:1px solid #d0d5dd!important;border-radius:14px 14px 0 0!important;
   box-shadow:0 -8px 28px rgba(0,0,0,.18)!important;font-size:15px!important;box-sizing:border-box!important;
   position:fixed!important;left:8px!important;right:8px!important;width:auto!important;max-width:none!important;
   bottom:calc(64px + env(safe-area-inset-bottom))!important;top:auto!important;max-height:min(58vh,480px)!important;
   overflow-y:auto!important;-webkit-overflow-scrolling:touch;padding:6px 0 8px!important;margin:0!important}
 html.kfm ul.ui-autocomplete .ui-menu-item{min-height:48px;display:flex!important;align-items:center;margin:0!important;padding:0!important;border:0!important;font-size:15px!important}
 html.kfm ul.ui-autocomplete .ui-menu-item>div{width:100%;padding:12px 14px!important;box-sizing:border-box;line-height:1.35!important;white-space:normal!important}
 html.kfm ul.ui-autocomplete .ui-menu-item.ui-state-active>div,html.kfm ul.ui-autocomplete .ui-menu-item>div.ui-state-active{background:#f0f4f8!important;border:0!important;margin:0!important;color:#222!important}
 html.kfm ul.ui-autocomplete .ui-menu-item.kfm-ac-on>div{background:#e8f0fe!important;font-weight:600}
 html.kfm ul.ui-autocomplete .ui-menu-item.kfm-ac-on>div::before{content:'✓ ';color:#1a73e8}
 html.kfm ul.ui-autocomplete .ui-item-select-all>div{font-weight:700;background:#f7f8fa!important}
 #kfm-ac-done{position:fixed;left:0;right:0;bottom:0;z-index:2147483600;padding:10px 12px calc(10px + env(safe-area-inset-bottom));background:rgba(255,255,255,.96);border-top:1px solid #e5e5e5;box-shadow:0 -4px 16px rgba(0,0,0,.08);display:none}
 #kfm-ac-done.kfm-ac-done-on{display:block}
 #kfm-ac-done button{width:100%;min-height:48px;border:0;border-radius:12px;background:#1a73e8;color:#fff;font-size:17px;font-weight:700}
  #kfm-ver{position:fixed;left:4px;bottom:calc(2px + env(safe-area-inset-bottom));z-index:2147483646;color:#aaa;font:400 10px -apple-system,sans-serif;pointer-events:none;background:transparent}
 html.kfm-finder #kfm-ver{display:none}
 #kfm-badge{position:fixed;left:6px;bottom:calc(70px + env(safe-area-inset-bottom));z-index:100000;background:rgba(26,127,55,.9);color:#fff;font:600 10px -apple-system,sans-serif;
   padding:3px 6px;border-radius:10px;transition:opacity .5s}
 #kfm-badge b{margin-left:6px;cursor:pointer}
${SCROLL_CSS}`;
  // v0.1.22: iPhone 全サイズ（SE〜16 Pro Max）と横向き。Keepa の固定幅（.filter-input 440px / #contentAlign min-width 420〜900）と 100vw、safe-area を吸収
  const ADAPT_CSS = `
html.kfm{--kfm-sat:env(safe-area-inset-top,0px);--kfm-sab:env(safe-area-inset-bottom,0px);--kfm-sal:env(safe-area-inset-left,0px);--kfm-sar:env(safe-area-inset-right,0px);
  --nav-h:calc(50px + env(safe-area-inset-top,0px))}
html.kfm:not(.kfm-product),html.kfm:not(.kfm-product) body{max-width:100%!important;width:100%!important;min-width:0!important;box-sizing:border-box}
html.kfm:not(.kfm-product) #contentAlign,html.kfm:not(.kfm-product) #contentAlign[data-layout]{
  min-width:0!important;max-width:100%!important;width:100%!important;margin-left:0!important;margin-right:0!important;
  --col-min:0!important;--col-max:100%!important;--col-side:0px!important;--gutter:12px;box-sizing:border-box!important;left:auto!important}
html.kfm:not(.kfm-product) #content,html.kfm:not(.kfm-product) #bodyPanel,html.kfm:not(.kfm-product) #wrapper,html.kfm:not(.kfm-product) .mainContent,
html.kfm:not(.kfm-product) .data-container,html.kfm:not(.kfm-product) .grid-wrapper,html.kfm:not(.kfm-product) .grid-filter-form,html.kfm:not(.kfm-product) #grid-form-finder{
  max-width:100%!important;min-width:0!important;box-sizing:border-box!important}
html.kfm:not(.kfm-product) .filter-input,html.kfm:not(.kfm-product) .filter-input.-mid,html.kfm:not(.kfm-product) .filter-input.-wide,
html.kfm:not(.kfm-product) .filter-text--wrapper>.filter-text,html.kfm:not(.kfm-product) .filter-jump,html.kfm:not(.kfm-product) .filter-columns{
  width:100%!important;max-width:100%!important;min-width:0!important;box-sizing:border-box!important}
html.kfm:not(.kfm-product) .card.-w-min-800,html.kfm:not(.kfm-product) [class*="-w-min-"]{min-width:0!important;max-width:100%!important}
html.kfm:not(.kfm-product) .card.-w-flex{width:100%!important;max-width:100%!important}
html.kfm:not(.kfm-product) .popup--medium{min-width:0!important;max-width:100%!important}
html.kfm .knav--fixed,html.kfm .knav.knav--fixed{padding-top:var(--kfm-sat);padding-left:var(--kfm-sal);padding-right:var(--kfm-sar);box-sizing:border-box}
html.kfm body .kfm-bottombar{left:0!important;right:0!important;bottom:0!important;width:auto!important;max-width:none!important;
  overflow:visible!important;
  padding-left:max(8px,var(--kfm-sal))!important;padding-right:max(8px,var(--kfm-sar))!important;
  padding-bottom:calc(8px + var(--kfm-sab))!important}
html.kfm body .kfm-bottombar #kfm-bb-tog{display:flex!important}
#kfm-pager{left:max(8px,var(--kfm-sal))!important;right:max(8px,var(--kfm-sar))!important;width:auto!important;max-width:none!important}
#kfm-list,html.kfm body .knav-row,html.kfm-manage,html.kfm-manage body{max-width:100%!important}
html.kfm body .generalOverlay:has(.grid-filter-form--view-only),html.kfm body .generalOverlay.kfm-afov{
  top:calc(70px + var(--kfm-sat))!important;left:max(8px,var(--kfm-sal))!important;right:max(8px,var(--kfm-sar))!important;
  max-height:calc(100dvh - 160px - var(--kfm-sat) - var(--kfm-sab))!important}
html.kfm ul.ui-autocomplete{left:max(8px,var(--kfm-sal))!important;right:max(8px,var(--kfm-sar))!important;
  bottom:calc(64px + var(--kfm-sab))!important}
#kfm-trackbar{padding-left:max(12px,var(--kfm-sal));padding-right:max(12px,var(--kfm-sar))}
#kfm-tm-fab{right:max(12px,var(--kfm-sar));bottom:calc(16px + var(--kfm-sab))}
#kfm-ac-done{padding-left:max(12px,var(--kfm-sal));padding-right:max(12px,var(--kfm-sar))}
#kfm-ask .kfm-ask-b,#kfm-sheet .kfm-sh,#kfm-tm-sheet .kfm-tm-box,#kfm-cols .kfm-cols-sh{
  padding-left:max(14px,var(--kfm-sal));padding-right:max(14px,var(--kfm-sar))}
html.kfm-track #track{padding-left:max(12px,var(--kfm-sal))!important;padding-right:max(12px,var(--kfm-sar))!important;
  top:var(--kfm-sat)!important}
@media (orientation:landscape) and (max-height:500px){
  html.kfm body .kfm-bottombar{padding-top:6px!important;gap:4px!important}
  #kfm-pager{min-height:48px;padding-top:4px!important;padding-bottom:4px!important}
  #kfm-cols .kfm-cols-sh{height:100dvh;max-height:100dvh}
  #kfm-sheet .kfm-sh{max-height:92dvh}
  html.kfm-track #track{bottom:calc(56px + var(--kfm-sab))!important}
  html.kfm-track #kfm-trackbar{height:calc(56px + var(--kfm-sab))}
}`;
  const st = document.createElement('style'); st.id = 'kfm-main-css'; st.textContent = css + TM_CSS + ADAPT_CSS;
  (function mountCss() {
    const p = document.head || document.documentElement;
    if (p) { if (!document.getElementById('kfm-main-css')) p.appendChild(st); }
    else setTimeout(mountCss, 0);
  })();

  // ---------- grid (virtualized ag-Grid → own card list) ----------
  const px = v => parseFloat(v) || 0;
  const ASIN_RE = /\b([A-Z0-9]{10})\b/;
  const HIDE_COLS = new Set(['domainId', 'urlAmazon', 'urlKeepa']);
  const COL_LABELS = {
    imagesCSV: '画像', title: '商品名', asin: 'ASIN',
    SALES_current: '売れ筋ランキング 現在', SALES_avg180: '売れ筋ランキング 180日平均',
    monthlySold: '月間販売数',
    BUY_BOX_SHIPPING_current: 'Buy Box 現在', NEW_current: '新品 現在',
    COUNT_NEW_current: '新品出品者数', COUNT_NEW_avg180: '新品出品者数 180日平均',
    AMAZON_current: 'Amazon 現在', AMAZON_outOfStockPercentage90: 'Amazon 在庫切れ% 90日',
    NEW_FBA_current: '新しい、第三者FBA 現在', fbaFees: 'FBA Pick&Pack 料金',
    referralFeePercentage: '紹介料％', brand: 'ブランド', eanList: 'EAN',
    variationCSV: 'バリエーション数', variations: 'バリエーション数',
    BUY_BOX_STATS_365: 'Buy Box 勝者数 365日', BUY_BOX_sellerCount365: 'Buy Box 勝者数 365日',
    COUNT_NEW_avg180: '新品出品者数 180日平均'
  };
  function buildLabels(grid) {
    const map = {};
    const groups = [];
    grid.querySelectorAll('.ag-header-group-cell').forEach(g => {
      const t = g.querySelector('.ag-header-group-text');
      const text = norm(t ? t.textContent : g.textContent); if (!text) return;
      groups.push({ text, idx: +g.getAttribute('aria-colindex') || 0, span: +g.getAttribute('aria-colspan') || 0,
        left: px(g.style.left), width: px(g.style.width), pin: !!g.closest('.ag-pinned-left-header,.ag-pinned-right-header') });
    });
    grid.querySelectorAll('.ag-header-cell[col-id]').forEach(h => {
      const id = h.getAttribute('col-id');
      if (COL_LABELS[id]) { map[id] = COL_LABELS[id]; return; }
      const t = h.querySelector('.ag-header-cell-text');
      const text = norm(t ? t.textContent : h.textContent);
      const idx = +h.getAttribute('aria-colindex') || 0, left = px(h.style.left), w = px(h.style.width);
      const pin = !!h.closest('.ag-pinned-left-header,.ag-pinned-right-header');
      let g = idx ? groups.find(x => x.idx && x.span && idx >= x.idx && idx < x.idx + x.span) : null;
      if (!g && w) g = groups.find(x => x.pin === pin && x.width && left >= x.left - 2 && left < x.left + x.width - 2);
      map[id] = norm([g && g.text !== text ? g.text : '', text].filter(Boolean).join(' ')) || id;
    });
    return map;
  }
  const MINOR_RE = /^(eanList|ean|upcList|jan)\b|\b(EAN|JAN|UPC)\b/i;
  const COLOR_MAP = {
    SALES_current: '#8FBC8F', SALES_avg180: '#8FBC8F', SALES_highest: '#8FBC8F',
    BUY_BOX_SHIPPING_current: '#ff00b4',
    NEW_current: '#8888dd', COUNT_NEW_current: '#8888dd', COUNT_NEW_avg180: '#8888dd',
    AMAZON_current: '#FFA500', AMAZON_outOfStockPercentage90: '#FFA500',
    NEW_FBA_current: '#ff5722'
  };
  const DARK = { '#8fbc8f': '#5f9e5f', '#ffa500': '#e08a00', '#ff00b4': '#d1009a', '#8888dd': '#6666cc', '#ff5722': '#e64a19', '#40bdb2': '#2a9d93' };
  function toHex(c) {
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(c || '');
    return m ? '#' + [m[1], m[2], m[3]].map(n => (+n).toString(16).padStart(2, '0')).join('') : (c || '').toLowerCase();
  }
  const darken = c => DARK[toHex(c)] || c;
  function cellColor(c, id) {
    const e = c.querySelector('[style*="color"]') || (c.style && c.style.color ? c : null);
    const col = e && e.style.color;
    if (col && !/^(rgb\(0, 0, 0\)|black|#000(000)?|inherit|initial)$/i.test(col)) return col;
    return COLOR_MAP[id] || '';
  }
  // 「300+(最新のアップデート: 6 時間前)」→ 本体 + 注記（全角/半角カッコ）
  function splitNote(t) {
    const m = /^(.*?)\s*[（(]([^()（）]*)[)）]\s*$/.exec(t || '');
    return m && m[1].trim() ? { main: m[1].trim(), note: m[2].trim() } : { main: t, note: '' };
  }
  function noteEl(n) { const e = el('small', 'kfm-note', n); return e; }
  function valueEl(x, big) {
    const b = el('b');
    const sn = splitNote(x.text || '–');
    const t = sn.main || '–';
    const m = /^(.*?)\s*(Top\s*[\d.,]+\s*%.*)$/i.exec(t);
    b.appendChild(document.createTextNode(m ? m[1] : t));
    if (x.color) b.style.color = darken(x.color);
    if (m) { const sub = el('small', 'kfm-sub', m[2]); sub.style.color = darken('#40bdb2'); b.appendChild(sub); }
    if (sn.note) b.appendChild(noteEl(sn.note));
    return b;
  }
  function labelEl(text, color) {
    const sp = el('span');
    if (color) { const dot = el('i', 'kfm-dot'); dot.style.background = color; sp.appendChild(dot); }
    sp.appendChild(document.createTextNode(text));
    return sp;
  }
  const showField = (id, label) => !SHOW_FIELDS.length || SHOW_FIELDS.includes(id) || has(label, SHOW_FIELDS) || has(id, SHOW_FIELDS);
  const cache = new Map();   // rowIndex -> data
  let sig = '', harvesting = false, rendered = '';
  const openSet = new Set();   // ASIN ごとの展開状態
  function pagingText(grid) { const p = grid.querySelector('.ag-paging-panel'); return p ? norm(p.textContent) : ''; }
  function rowCount(grid) {
    const c = grid.querySelector('.ag-center-cols-container');
    const r = grid.querySelector('.ag-center-cols-container .ag-row');
    const rh = r ? px(r.style.height) || r.offsetHeight || 56 : 56;
    return c ? Math.round(px(c.style.height) / rh) : 0;
  }
  function readRow(row, pinnedRows, map) {
    const idx = row.getAttribute('row-index');
    const cells = [...row.querySelectorAll('.ag-cell')];
    pinnedRows.filter(p => p.getAttribute('row-index') === idx).forEach(p => cells.push(...p.querySelectorAll('.ag-cell')));
    const d = { idx: +idx, asin: '', title: '', img: '', fields: [], all: {} };
    const seen = new Set();
    cells.forEach(c => {
      const id = c.getAttribute('col-id') || ''; if (!id || seen.has(id)) return; seen.add(id);
      const text = norm(c.textContent);
      d.all[id] = { text, color: cellColor(c, id) };
      if (id === 'asin') { d.asin = (ASIN_RE.exec(text) || [])[1] || text; return; }
      if (id === 'title') { d.title = text; return; }
      if (id === 'imagesCSV') {
        const im = c.querySelector('img');
        const src = im ? im.getAttribute('src') || '' : '';
        if (src && !src.startsWith('data:')) d.img = src.replace(/_SS\d+_/i, '_SL200_');
        return;
      }
      if (HIDE_COLS.has(id) || has(id, HIDE_FIELDS)) return;
      const label = map[id] || id;
      if (has(label, HIDE_FIELDS)) return;
      d.fields.push({ id, label, text, color: cellColor(c, id),
        main: !MINOR_RE.test(id + ' ' + label) && showField(id, label) });
    });
    if (!d.asin) { const a = row.querySelector('a[href*="product/5-"]'); if (a) d.asin = (ASIN_RE.exec(a.getAttribute('href')) || [])[1] || ''; }
    return d;
  }
  let liveCols = [];
  const SKIP_COL = /^(imagesCSV|domainId|urlAmazon|urlKeepa)$|graph|chart|spark|image|img/i;
  function readColumns(grid) {
    const groups = [];
    grid.querySelectorAll('.ag-header-group-cell').forEach(g => {
      const t = g.querySelector('.ag-header-group-text'); const text = norm(t ? t.textContent : g.textContent); if (!text) return;
      groups.push({ text, idx: +g.getAttribute('aria-colindex') || 0, span: +g.getAttribute('aria-colspan') || 0,
        left: px(g.style.left), width: px(g.style.width), sec: secOf(g) });
    });
    const out = [];
    ['.ag-pinned-left-header', '.ag-header-viewport', '.ag-pinned-right-header'].forEach((sel, si) => {
      const sec = grid.querySelector(sel); if (!sec) return;
      [...sec.querySelectorAll('.ag-header-cell[col-id]')]
        .map(h => ({ h, idx: +h.getAttribute('aria-colindex') || 0, left: px(h.style.left) }))
        .sort((a, b) => (a.idx && b.idx) ? a.idx - b.idx : a.left - b.left)
        .forEach(({ h, idx, left }) => {
          const id = h.getAttribute('col-id'); if (!id || SKIP_COL.test(id) || out.some(o => o.id === id)) return;
          const t = h.querySelector('.ag-header-cell-text'); const text = norm(t ? t.textContent : h.textContent);
          const w = px(h.style.width);
          let g = idx ? groups.find(x => x.idx && x.span && idx >= x.idx && idx < x.idx + x.span) : null;
          if (!g && w) g = groups.find(x => x.sec === si && x.width && left >= x.left - 2 && left < x.left + x.width - 2);
          const group = g && g.text !== text ? g.text : '';
          out.push({ id, group, col: text || id, label: [group, text].filter(Boolean).join(' / ') || id });
        });
    });
    return out;
  }
  function secOf(e) { return e.closest('.ag-pinned-left-header') ? 0 : e.closest('.ag-pinned-right-header') ? 2 : 1; }
  function collect(grid) {
    const lc = readColumns(grid); if (lc.length) liveCols = lc;
    const map = buildLabels(grid);
    const pinned = [...grid.querySelectorAll('.ag-pinned-left-cols-container .ag-row, .ag-pinned-right-cols-container .ag-row')];
    let added = 0;
    grid.querySelectorAll('.ag-center-cols-container .ag-row[row-index]').forEach(r => {
      const d = readRow(r, pinned, map);
      if (!d.asin && !d.title) return;
      const old = cache.get(d.idx);
      if (old && old.asin === d.asin) { if (!d.title && old.title) d.title = old.title; if (!d.img && old.img) d.img = old.img; }   // v0.1.3: 後から埋まった名前・画像を取りこぼさない
      if (!old || old.asin !== d.asin || old.fields.length !== d.fields.length || old.title !== d.title || old.img !== d.img) { cache.set(d.idx, d); added++; }
    });
    return added;
  }
  const frame = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 80)));
  async function harvest(grid) {
    const vp = grid.querySelector('.ag-body-viewport'); if (!vp || harvesting || sorting) return;
    harvesting = true;
    try {
      const total = rowCount(grid);
      const step = Math.max(200, vp.clientHeight * 0.8);
      for (let top = 0; top <= vp.scrollHeight; top += step) {
        if (isTyping() || !onFinder()) break;
        vp.scrollTop = top; vp.dispatchEvent(new Event('scroll'));
        await frame(); collect(grid); renderList(grid, total);
        if (total && cache.size >= total) break;
      }
      vp.scrollTop = 0; vp.dispatchEvent(new Event('scroll'));
    } finally { harvesting = false; }
  }
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function link(href, text) { const a = el('a', null, text); a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.addEventListener('click', e => e.stopPropagation()); return a; }
  const ICON_COPY = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#555" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>';
  const ICON_OK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a7f37" stroke-width="3" aria-hidden="true"><path d="M4 12l5 5L20 6"/></svg>';
  const ICON_NG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d32f2f" stroke-width="3" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  function copyText(t) {
    const fb = () => { try { const ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px'; document.body.appendChild(ta);
      ta.select(); ta.setSelectionRange(0, t.length); const ok = document.execCommand('copy'); ta.remove(); return ok; } catch (e) { return false; } };
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t).then(() => true, () => fb());
    return Promise.resolve(fb());
  }
  function num(t) {
    if (!t) return NaN;
    const m = String(t).replace(/[,，\s]/g, '').match(/-?\d+(?:\.\d+)?/);
    return m ? parseFloat(m[0]) : NaN;
  }
  const yen = n => '¥' + Math.round(n).toLocaleString('ja-JP');
  function breakEven(d) {
    const get = id => { const x = d.fields.find(y => y.id === id); return x ? num(x.text) : NaN; };
    let P = get('BUY_BOX_SHIPPING_current');
    if (!(P > 0)) P = get('NEW_current');
    if (!(P > 0)) P = get('AMAZON_current');
    const F = get('fbaFees'), pct = get('referralFeePercentage');
    if (!(P > 0) || isNaN(F) || isNaN(pct)) return null;
    const R = Math.round(P * pct / 100);
    return { P, F, R, N: P - F - R };
  }
  function card(d) {
    const c = el('div', 'kfm-c'); c.dataset.idx = d.idx; if (d.asin) c.dataset.asin = d.asin;
    const h = el('div', 'kfm-h');
    if (d.img) { const im = el('img'); im.loading = 'lazy'; im.alt = '商品画像'; im.src = d.img; im.onerror = () => im.remove(); h.appendChild(im); }
    const meta = el('div', 'kfm-meta');
    const t = d.asin ? link('https://keepa.com/#!product/5-' + d.asin, d.title || d.asin) : el('div', null, d.title);
    t.className = 'kfm-t'; meta.appendChild(t);
    if (d.asin) {
      const ar = el('div', 'kfm-a', 'ASIN ' + d.asin);
      const cp = el('button', 'kfm-cp'); cp.type = 'button'; cp.setAttribute('aria-label', 'コピー'); cp.title = 'コピー';
      cp.innerHTML = ICON_COPY;
      cp.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); copyText(d.asin).then(ok => {
        cp.innerHTML = ok ? ICON_OK : ICON_NG; cp.setAttribute('aria-label', ok ? 'コピーしました' : 'コピー失敗');
        setTimeout(() => { cp.innerHTML = ICON_COPY; cp.setAttribute('aria-label', 'コピー'); }, 1500); }); });
      ar.appendChild(cp); meta.appendChild(ar);
      const l = el('div', 'kfm-l');
      l.appendChild(link('https://www.amazon.co.jp/dp/' + d.asin + '?psc=1', 'Amazonで開く'));
      l.appendChild(link('https://keepa.com/#!product/5-' + d.asin, 'Keepaで開く'));
      const tr = link('https://keepa.com/#!product/5-' + d.asin, '🔔 トラッキング');
      tr.addEventListener('click', () => { try { localStorage.setItem('kfmTrackReq', JSON.stringify({ asin: d.asin, t: Date.now() })); } catch (e) {} });
      l.appendChild(tr);
      meta.appendChild(l);
    }
    h.appendChild(meta); c.appendChild(h);
    const be = breakEven(d);
    if (be) {
      const bw = el('div', 'kfm-be');
      bw.appendChild(el('div', 'kfm-be-n', '損益分岐: ' + yen(be.N)));
      bw.appendChild(el('div', 'kfm-be-d', `売価 ${yen(be.P)} / FBA ${yen(be.F)} / 紹介料 ${yen(be.R)}`));
      c.appendChild(bw);
    }
    if (d.asin) {
      const g = el('a', 'kfm-g'); g.href = 'https://keepa.com/#!product/5-' + d.asin; g.target = '_blank'; g.rel = 'noopener';
      g.addEventListener('click', e => e.stopPropagation());
      const gi = el('img'); gi.loading = 'lazy'; gi.alt = '価格履歴'; gi.referrerPolicy = 'no-referrer';
      gi.src = 'https://graph.keepa.com/pricehistory.png?asin=' + encodeURIComponent(d.asin) +
        '&domain=5&salesrank=1&amazon=1&new=1&bb=1&fba=1&fbm=1&range=90&width=600&height=200';
      gi.onerror = () => g.remove(); g.appendChild(gi); c.appendChild(g);
    }
    const TOP = ['monthlySold', 'SALES_current', 'BUY_BOX_SHIPPING_current', 'NEW_current'],
      TOPL = { monthlySold: '月間販売数', SALES_current: 'ランキング', BUY_BOX_SHIPPING_current: 'Buy Box価格', NEW_current: '新品価格' };
    const top = el('div', 'kfm-top');
    TOP.forEach(id => { const x = d.fields.find(y => y.id === id) || (d.all[id] && { id, text: d.all[id].text, color: d.all[id].color || COLOR_MAP[id] || '' });
      if (!x) return;
      const bx = el('div', 'kfm-stat'); bx.appendChild(labelEl(TOPL[id], x.color)); bx.appendChild(valueEl(x, true)); top.appendChild(bx); });
    if (top.children.length) c.appendChild(top);
    if (liveCols.length) {
      const key = d.asin || String(d.idx);
      const tg = el('button', 'kfm-tg', openSet.has(key) ? '▴' : '▾'); tg.type = 'button'; tg.setAttribute('aria-label', '全項目');
      const all = el('div', 'kfm-all');
      const fill = () => {
        all.textContent = '';
        const groups = [];
        liveCols.forEach(col => { const v = d.all[col.id]; if (!v || col.id === 'asin' || col.id === 'title') return;
          const gname = col.group || 'その他';
          let g = groups.find(x => x.name === gname); if (!g) { g = { name: gname, items: [], color: '' }; groups.push(g); }
          const color = v.color || COLOR_MAP[col.id] || '';
          if (!g.color && color) g.color = color;
          g.items.push({ label: col.col, text: v.text, color });
        });
        const oth = groups.findIndex(g => g.name === 'その他'); if (oth >= 0) groups.push(groups.splice(oth, 1)[0]);
        groups.forEach(g => {
          const sec = el('div', 'kfm-gs');
          const hd = el('div', 'kfm-gh'); if (g.color) { const dot = el('i', 'kfm-dot'); dot.style.background = g.color; hd.appendChild(dot); }
          hd.appendChild(document.createTextNode(g.name)); sec.appendChild(hd);
          g.items.forEach(it => {
            const r = el('div', 'kfm-gr');
            r.appendChild(el('span', 'kfm-gl', it.label));
            const t = it.text || '–';
            const empty = /^[-–—]?$/.test(t.trim());
            const long = t.length > 18 || /[>›\/]/.test(t) && t.length > 10;
            const sn = empty ? { main: t, note: '' } : splitNote(t);
            const v = el('span', 'kfm-gv' + (empty ? ' kfm-empty' : '') + (long && !sn.note ? ' kfm-long' : ''), sn.main);
            if (!empty && it.color) v.style.color = darken(it.color);
            if (sn.note) v.appendChild(noteEl(sn.note));
            r.appendChild(v); sec.appendChild(r);
          });
          all.appendChild(sec);
        });
      };
      if (openSet.has(key)) { fill(); c.classList.add('kfm-x'); }
      tg.addEventListener('click', e => { e.preventDefault(); e.stopPropagation();
        const open = !openSet.has(key);
        if (open) { openSet.add(key); fill(); } else openSet.delete(key);
        c.classList.toggle('kfm-x', open); tg.textContent = open ? '▴' : '▾'; });
      c.appendChild(all); c.appendChild(tg);
    }
    // スワイプ用：中身を .kfm-inner に入れ、背面に送信アクション
    const inner = el('div', 'kfm-inner');
    while (c.firstChild) inner.appendChild(c.firstChild);
    const acts = el('div', 'kfm-swacts');
    const inList = cfg.mode === 'gas' && d.asin && listCache.has(d.asin);
    if (inList) addDelBtn(acts, d, c);
    const act = el('button', 'kfm-swa'); act.type = 'button'; act.tabIndex = -1;
    act.innerHTML = '<span class="kfm-swi">' + ICON_SEND + '</span><span class="kfm-swl"><span>Grok Botに</span><span>送る</span></span>';
    onTap(act, () => sendCard(d, c));
    acts.insertBefore(act, acts.firstChild);   // 左: 送る / 右端: 削除
    c.dataset.sw = String(acts.children.length * 96);
    c.appendChild(acts); c.appendChild(inner);
    if (cfg.mode === 'gas') { if (inList) markSent(c, '✓リストにあり'); }
    else if (d.asin && sentSet.has(d.asin)) markSent(c);
    c.addEventListener('scroll', () => { if (c.scrollLeft) c.scrollLeft = 0; }, { passive: true });
    attachSwipe(c, inner);
    return c;
  }
  // ---- スワイプ送信 ----
  function addDelBtn(acts, d, c) {
    if (acts.querySelector('.kfm-swdel')) return;
    const del = el('button', 'kfm-swa kfm-swdel'); del.type = 'button'; del.tabIndex = -1;
    del.innerHTML = '<span class="kfm-swi">' + ICON_TRASH + '</span><span class="kfm-swl"><span>削除</span></span>';
    onTap(del, () => deleteItem(d.asin, d.title, c));
    acts.appendChild(del); c.dataset.sw = String(acts.children.length * 96);
  }
  // v0.0.34: 背面ボタンは touchend / pointerup / click のどれで来ても1回だけ実行（iOSでclickが来ないことがある）
  function onTap(btn, fn) {
    let sx = 0, sy = 0, last = 0, tt = false;
    const fire = e => { if (e) { e.preventDefault(); e.stopPropagation(); } const n = Date.now(); if (n - last < 700) return; last = n; try { fn(); } catch (er) { console.log('[kfm] tap', er); } };
    btn.addEventListener('touchstart', e => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; tt = true; e.stopPropagation(); }, { passive: true });
    btn.addEventListener('touchend', e => { if (!tt) return; tt = false; const t = e.changedTouches[0]; if (Math.abs(t.clientX - sx) < 12 && Math.abs(t.clientY - sy) < 12) fire(e); }, { passive: false });
    btn.addEventListener('pointerup', e => { if (e.pointerType === 'mouse' || e.pointerType === 'pen') fire(e); });
    btn.addEventListener('click', fire);
  }
  // v0.0.34: window.confirm は iPhone の拡張機能から出ないことがあるので、画面内の確認シートを使う
  function askSheet(msg, sub, okLabel, danger) {
    return new Promise(res => {
      const old = document.getElementById('kfm-ask'); if (old) old.remove();
      const bg = el('div'); bg.id = 'kfm-ask';
      const box = el('div', 'kfm-ask-b');
      box.appendChild(el('div', 'kfm-ask-t', msg)); if (sub) box.appendChild(el('div', 'kfm-ask-s', sub));
      const row = el('div', 'kfm-ask-r');
      const no = el('button', 'kfm-ask-no', 'やめる'); no.type = 'button';
      const ok = el('button', 'kfm-ask-ok' + (danger ? ' red' : ''), okLabel || 'OK'); ok.type = 'button';
      row.appendChild(no); row.appendChild(ok); box.appendChild(row); bg.appendChild(box);
      const end = v => { bg.remove(); res(v); };
      onTap(no, () => end(false)); onTap(ok, () => end(true));
      bg.addEventListener('click', e => { if (e.target === bg) end(false); });
      document.body.appendChild(bg);
    });
  }
  const ICON_TRASH = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>';
  const ICON_SEND = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" aria-hidden="true"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>';
  const SW_OPEN = 96;
  let swOpen = null;
  function setX(inner, x, anim) { inner.style.transition = anim ? 'transform .2s ease' : 'none'; inner.style.transform = x ? `translateX(${x}px)` : ''; }
  function closeSwipe() { if (swOpen) { setX(swOpen, 0, true); const cc = swOpen.closest('.kfm-c'); if (cc) cc.classList.remove('kfm-swopen', 'kfm-swiping'); swOpen = null; } }
  // 横ずれ防止：カード・リスト・ページの横スクロール位置を 0 に戻す
  function resetShift(list) {
    swOpen = null;
    if (list) { list.style.removeProperty('overflow-x'); list.scrollLeft = 0; list.querySelectorAll('.kfm-c').forEach(cc => { cc.style.removeProperty('overflow-x'); cc.style.removeProperty('max-width'); cc.scrollLeft = 0; if (!cc.classList.contains('kfm-swopen')) { const i = cc.querySelector('.kfm-inner'); if (i) { i.style.transition = 'none'; i.style.transform = ''; } } }); }
    if (window.scrollX) window.scrollTo(0, window.scrollY);
    if (document.documentElement.scrollLeft) document.documentElement.scrollLeft = 0;
    if (document.body && document.body.scrollLeft) document.body.scrollLeft = 0;
  }
  // v0.0.33: スクロール中・指が触れている間は scrollTo しない（iOSで慣性スクロールが止まる原因）
  let kfmTouching = false, kfmLastScroll = 0, kfmXFix = 0;
  const scrollBusy = () => kfmTouching || Date.now() - kfmLastScroll < 450;
  document.addEventListener('touchstart', () => { kfmTouching = true; }, { passive: true, capture: true });
  ['touchend', 'touchcancel'].forEach(ev => document.addEventListener(ev, e => { if (!e.touches || !e.touches.length) { kfmTouching = false; kfmLastScroll = Date.now(); } }, { passive: true, capture: true }));
  window.addEventListener('scroll', () => {
    kfmLastScroll = Date.now();
    clearTimeout(kfmXFix);
    kfmXFix = setTimeout(function fx() {
      if (scrollBusy()) { kfmXFix = setTimeout(fx, 300); return; }
      if (window.scrollX > 1 && document.documentElement.classList.contains('kfm') && document.getElementById('kfm-list')) window.scrollTo(0, window.scrollY);
    }, 500);
  }, { passive: true });
  window.addEventListener('hashchange', () => resetShift(document.getElementById('kfm-list')));
  document.addEventListener('touchstart', e => { if (swOpen && !e.target.closest('.kfm-c.kfm-swopen')) closeSwipe(); }, { passive: true, capture: true });
  function attachSwipe(c, inner) {
    let x0 = 0, y0 = 0, base = 0, mode = '', cur = 0, moved = false;
    inner.addEventListener('touchstart', e => {
      const t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; mode = ''; moved = false;
      const W = +c.dataset.sw || SW_OPEN; inner._w = W;
      base = swOpen === inner ? -W : 0; cur = base;
    }, { passive: true });
    inner.addEventListener('touchmove', e => {
      const t = e.touches[0], dx = t.clientX - x0, dy = t.clientY - y0;
      if (!mode) {
        if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.5) { mode = 'h'; if (swOpen && swOpen !== inner) closeSwipe(); }
        else if (Math.abs(dy) > 12) mode = 'v';
        else return;
      }
      if (mode !== 'h') return;
      moved = true; c.classList.add('kfm-swiping');   // v0.0.33: 縦スクロールは touch-action:pan-y でブラウザに任せる（preventDefault しない）
      cur = Math.max(-(inner._w || SW_OPEN) - 30, Math.min(0, base + dx)); setX(inner, cur, false);
    }, { passive: true });
    inner.addEventListener('touchcancel', () => { if (mode === 'h') { c.classList.remove('kfm-swiping'); setX(inner, swOpen === inner ? -(inner._w || SW_OPEN) : 0, true); } mode = ''; }, { passive: true });
    inner.addEventListener('touchend', () => {
      if (mode !== 'h') return;
      c.classList.remove('kfm-swiping'); c.scrollLeft = 0;
      const W = inner._w || SW_OPEN;
      if (cur < -W / 2) { setX(inner, -W, true); swOpen = inner; c.classList.add('kfm-swopen'); }
      else { setX(inner, 0, true); if (swOpen === inner) swOpen = null; c.classList.remove('kfm-swopen'); }
    }, { passive: true });
    inner.addEventListener('click', e => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } else if (swOpen === inner) { e.preventDefault(); e.stopPropagation(); closeSwipe(); } }, true);
  }
  // ---- 設定（GM ストレージ。URL・認証はファイルに含めない）----
  const gv = async (k, d) => {
    try { if (typeof GM !== 'undefined' && GM.getValue) return await GM.getValue(k, d); } catch (e) {}
    try { if (typeof GM_getValue === 'function') return GM_getValue(k, d); } catch (e) {}
    return d;
  };
  const sv = (k, v) => {
    try { if (typeof GM !== 'undefined' && GM.setValue) return GM.setValue(k, v); } catch (e) {}
    try { if (typeof GM_setValue === 'function') return GM_setValue(k, v); } catch (e) {}
  };
  let sentSet = new Set();
  gv('kfmSentAsins', '[]').then(v => { try { const a = typeof v === 'string' ? JSON.parse(v) : v; if (Array.isArray(a)) a.forEach(x => sentSet.add(x)); rendered = ''; schedule(); } catch (e) {} });
  function rememberSent(asin) {
    sentSet.delete(asin); sentSet.add(asin);
    const arr = [...sentSet].slice(-500); sentSet = new Set(arr); sv('kfmSentAsins', JSON.stringify(arr));
  }
  function markSent(c, text) {
    const a = c.querySelector('.kfm-a'); if (!a) return;
    const old = a.querySelector('.kfm-sent'); if (old) old.remove();
    a.appendChild(el('span', 'kfm-sent', text || '✓送信済み'));
  }
  function normAuth(v) {
    let t = String(v || '').trim().replace(/^authorization\s*:\s*/i, '').trim();
    if (!t) return '';
    if (!/^(Bearer|Basic|Token|Bot|Digest)\s+/i.test(t)) t = 'Bearer ' + t;
    return t;
  }
  function toast(msg, ok) {
    let t = document.getElementById('kfm-toast');
    if (!t) { t = el('div'); t.id = 'kfm-toast'; document.body.appendChild(t); }
    t.textContent = msg; t.className = ok === 'warn' ? 'warn' : ok ? 'ok' : 'ng'; t.style.opacity = '1';
    clearTimeout(t._h); t._h = setTimeout(() => { t.style.opacity = '0'; }, 2000);
  }
  // 設定値（メモリにも保持）
  const cfg = { mode: 'webhook', gasUrl: '', gasKey: '', listGraph: true, hand: 'right' };
  const applyHand = () => { const pg = document.getElementById('kfm-pager'); if (pg) pg.classList.toggle('kfm-hand-left', cfg.hand === 'left'); };
  (async () => {
    cfg.mode = await gv('kfmMode', 'webhook') || 'webhook';
    cfg.gasUrl = await gv('kfmGasUrl', '') || ''; cfg.gasKey = await gv('kfmGasKey', '') || '';
    cfg.listGraph = (await gv('kfmListGraph', 'on')) !== 'off';
    cfg.hand = (await gv('kfmHand', 'right')) === 'left' ? 'left' : 'right'; applyHand();
    tm.dry = (await gv('kfmPractice', 'off')) === 'on'; try { tmBar(); } catch (e) {}
    try { const m = JSON.parse(await gv('kfmImgMap', '{}') || '{}'); Object.entries(m).forEach(([k, v]) => imgMap.set(k, v)); } catch (e) {}
    if (cfg.mode === 'gas') refreshList();
  })();
  async function openSettings() {
    const old = document.getElementById('kfm-sheet'); if (old) old.remove();
    const url = await gv('kfmWebhookUrl', ''), auth = await gv('kfmWebhookAuth', '');
    const sh = el('div'); sh.id = 'kfm-sheet';
    const box = el('div', 'kfm-sh'); sh.appendChild(box);
    const top = el('div', 'kfm-sh-top'); top.appendChild(el('span', null, '設定'));
    const close = el('button', null, '閉じる'); close.type = 'button'; close.addEventListener('click', () => sh.remove());
    top.appendChild(close); box.appendChild(top);
    const form = el('div', 'kfm-set');
    const inp = (type, val, ph) => { const i = el('input'); i.type = type; i.value = val || ''; i.placeholder = ph; i.autocomplete = 'off'; i.setAttribute('autocapitalize', 'off'); i.spellcheck = false; return i; };
    const modeRow = el('div', 'kfm-set-mode');
    const mk = (v, txt) => { const lb = el('label'); const r = el('input'); r.type = 'radio'; r.name = 'kfmMode'; r.value = v; r.checked = cfg.mode === v; lb.appendChild(r); lb.appendChild(document.createTextNode(' ' + txt)); modeRow.appendChild(lb); return r; };
    const rGas = mk('gas', 'あとで見るリストに保存（おすすめ）'); mk('webhook', 'Grok Botに直接送る');
    const gBox = el('div', 'kfm-set-g'), wBox = el('div', 'kfm-set-g');
    const g1 = inp('url', cfg.gasUrl, 'https://script.google.com/macros/s/…/exec'), g2 = inp('password', cfg.gasKey, 'API_KEY');
    [el('label', null, 'リストのURL（Web App URL）'), g1, el('label', null, '合言葉（API_KEY）'), g2].forEach(x => gBox.appendChild(x));
    const w1 = inp('url', url, 'https://...'), w2 = inp('password', auth, 'Bearer ...');
    [el('label', null, '送り先URL（Webhook URL）'), w1, el('label', null, '認証キー（Authorizationヘッダー。画面からそのまま貼り付け）'), w2].forEach(x => wBox.appendChild(x));
    const sync = () => { const g = rGas.checked; gBox.style.display = g ? '' : 'none'; wBox.style.display = g ? 'none' : ''; };
    modeRow.addEventListener('change', sync); sync();
    const gr = el('label', 'kfm-set-chk'); const grc = el('input'); grc.type = 'checkbox'; grc.checked = cfg.listGraph;
    gr.appendChild(grc); gr.appendChild(document.createTextNode(' リストにミニグラフを表示')); gBox.appendChild(gr);
    const handRow = el('div', 'kfm-set-hand'); handRow.appendChild(el('b', null, '利き手'));
    const mkH = (v, txt) => { const lb = el('label'); const r = el('input'); r.type = 'radio'; r.name = 'kfmHand'; r.value = v; r.checked = cfg.hand === v; lb.appendChild(r); lb.appendChild(document.createTextNode(' ' + txt)); handRow.appendChild(lb); return r; };
    mkH('right', '右手'); const hLeft = mkH('left', '左手');
    const save = el('button', 'kfm-set-save', '保存'); save.type = 'button';
    save.addEventListener('click', async () => {
      cfg.hand = hLeft.checked ? 'left' : 'right'; applyHand(); await sv('kfmHand', cfg.hand);
      cfg.listGraph = grc.checked; await sv('kfmListGraph', cfg.listGraph ? 'on' : 'off');
      tm.dry = prc.checked; await sv('kfmPractice', tm.dry ? 'on' : 'off'); try { tmBar(); } catch (e) {}
      cfg.mode = rGas.checked ? 'gas' : 'webhook'; cfg.gasUrl = g1.value.trim(); cfg.gasKey = g2.value.trim();
      await sv('kfmMode', cfg.mode); await sv('kfmGasUrl', cfg.gasUrl); await sv('kfmGasKey', cfg.gasKey);
      await sv('kfmWebhookUrl', w1.value.trim()); await sv('kfmWebhookAuth', normAuth(w2.value));
      sh.remove(); toast('保存しました', true);
      if (cfg.mode === 'gas') refreshList(); else { listCache.clear(); rendered = ''; schedule(); }
    });
    const pr = el('label', 'kfm-set-chk kfm-set-prac'); const prc = el('input'); prc.type = 'checkbox'; prc.checked = tm.dry;
    pr.appendChild(prc); pr.appendChild(document.createTextNode(' 練習モード（削除せずに動きだけ確かめる）'));
    const prh = el('div', 'kfm-set-note', 'トラッキング整理で、実際には削除せずに動きを確かめます。慣れたらオフにしてください。');
    [modeRow, gBox, wBox, handRow, pr, prh, save].forEach(x => form.appendChild(x));
    form.appendChild(el('div', 'kfm-set-note', 'URLとキーはこのiPhoneの中だけに保存されます。スクリプトのファイルには入りません。'));
    form.appendChild(el('div', 'kfm-set-ver', 'バージョン ' + VERSION));
    box.appendChild(form);
    sh.addEventListener('click', e => { if (e.target === sh) sh.remove(); });
    document.body.appendChild(sh);
  }
  // ---- Apps Script（Code.gs 準拠：キーは ?key=、GET action=list/exists、POST {action:add,item,mode} / {action:delete,asin}）----
  const listCache = new Map();   // asin -> item
  const imgMap = new Map();      // asin -> 画像URL（端末内のみ・サーバー変更なし）
  function rememberImg(asin, src) {
    if (!asin || !src) return; imgMap.delete(asin); imgMap.set(asin, src);
    const arr = [...imgMap].slice(-500); imgMap.clear(); arr.forEach(([k, v]) => imgMap.set(k, v));
    sv('kfmImgMap', JSON.stringify(Object.fromEntries(arr)));
  }
  function thumbFor(asin) {
    if (imgMap.has(asin)) return imgMap.get(asin);
    for (const d of cache.values()) if (d.asin === asin && d.img) return d.img;
    return `https://images-na.ssl-images-amazon.com/images/P/${asin}.09.MZZZZZZZ.jpg`;   // ASINからの汎用URL（無い商品もある）
  }
  let listLoaded = false;
  const gasApi = q => `${cfg.gasUrl}${cfg.gasUrl.includes('?') ? '&' : '?'}key=${encodeURIComponent(cfg.gasKey)}${q || ''}`;
  function gmReq(method, url, body) {
    const xhr = (typeof GM !== 'undefined' && GM.xmlHttpRequest) ? GM.xmlHttpRequest.bind(GM) : (typeof GM_xmlhttpRequest === 'function' ? GM_xmlhttpRequest : null);
    const parse = t => { try { return JSON.parse(t); } catch (e) { return { ok: false, error: 'bad response' }; } };
    if (xhr) return new Promise(res => {
      try {
        const r = xhr({ method, url, headers: body ? { 'Content-Type': 'application/json' } : {}, data: body, timeout: 30000,
          onload: x => res(x.status >= 200 && x.status < 300 ? parse(x.responseText) : { ok: false, error: 'HTTP ' + x.status }),
          onerror: () => res({ ok: false, error: 'network' }), ontimeout: () => res({ ok: false, error: 'timeout' }) });
        if (r && typeof r.then === 'function') r.then(x => x && x.responseText !== undefined && res(parse(x.responseText)), () => res({ ok: false, error: 'network' }));
      } catch (e) { res({ ok: false, error: String(e) }); }
    });
    return fetch(url, { method, body, headers: body ? { 'Content-Type': 'text/plain;charset=utf-8' } : {} }).then(r => r.json()).catch(e => ({ ok: false, error: String(e) }));
  }
  async function refreshList() {
    if (cfg.mode !== 'gas' || !cfg.gasUrl || !cfg.gasKey) return null;
    const r = await gmReq('GET', gasApi('&action=list'));
    if (!r || !r.ok || !Array.isArray(r.items)) return null;
    listCache.clear(); r.items.forEach(it => it && it.asin && listCache.set(String(it.asin), it));
    listLoaded = true; rendered = ''; try { schedule(); } catch (e) {}
    return r.items;
  }
  const fmtDate = v => { if (!v) return '不明'; const d = new Date(v); if (isNaN(d)) return String(v);
    const j = new Date(d.getTime() + 9 * 3600e3); return j.toISOString().slice(0, 16).replace('T', ' ') + ' JST'; };
  let deleting = new Set();
  async function deleteItem(asin, title, c) {
    if (!asin || deleting.has(asin)) return false;
    if (!cfg.gasUrl || !cfg.gasKey) { closeSwipe(); toast('リストの設定がまだです。⚙ から設定してください', false); return false; }
    if (!await askSheet('あとで見るリストから外しますか？', title || asin, '外す', true)) { closeSwipe(); return false; }
    deleting.add(asin); toast('リストから外しています…', 'warn');
    let r; try { r = await gmReq('POST', gasApi(), JSON.stringify({ action: 'delete', asin })); } catch (e) { r = { ok: false, error: String(e) }; }
    deleting.delete(asin); closeSwipe();
    if ((r && r.ok) || (r && r.notFound)) {
      listCache.delete(asin);
      if (c) { const b = c.querySelector('.kfm-sent'); if (b) b.remove(); const dl = c.querySelector('.kfm-swdel'); if (dl) dl.remove(); c.dataset.sw = String(c.querySelectorAll('.kfm-swa').length * 96); }
      rendered = c && c.isConnected ? listStamp() : ''; if (!rendered) schedule(); toast(r.ok ? 'リストから外しました' : 'もうリストにありませんでした', true); return true;
    }
    if (r && r.error) console.log('[kfm] delete error', r.error);
    toast('リストから外せませんでした。通信を確かめて、もう一度お試しください', false); return false;
  }
  async function openListSheet() {
    const old = document.getElementById('kfm-sheet'); if (old) old.remove();
    if (cfg.mode !== 'gas' || !cfg.gasUrl || !cfg.gasKey) { openSettings(); return; }
    const sh = el('div'); sh.id = 'kfm-sheet';
    const box = el('div', 'kfm-sh'); sh.appendChild(box);
    const top = el('div', 'kfm-sh-top'); top.appendChild(el('span', null, 'あとで見るリスト'));
    const right = el('div'); right.style.display = 'flex'; right.style.gap = '6px';
    const web = el('a', 'kfm-sh-link', 'Webで開く'); web.href = gasApi(''); web.target = '_blank'; web.rel = 'noopener noreferrer';
    const close = el('button', null, '閉じる'); close.type = 'button'; close.addEventListener('click', () => sh.remove());
    right.appendChild(web); right.appendChild(close); top.appendChild(right); box.appendChild(top);
    const q = el('input', 'kfm-sh-q'); q.type = 'search'; q.placeholder = 'タイトル・ASINで検索'; box.appendChild(q);
    const list = el('div', 'kfm-sh-list'); box.appendChild(list);
    list.appendChild(el('div', null, '読み込み中…'));
    sh.addEventListener('click', e => { if (e.target === sh) sh.remove(); });
    document.body.appendChild(sh);
    const items = await refreshList() || [...listCache.values()];
    const draw = () => {
      list.textContent = '';
      const k = q.value.trim().toLowerCase();
      const rows = items.filter(it => !k || String(it.title || '').toLowerCase().includes(k) || String(it.asin).toLowerCase().includes(k));
      if (!rows.length) { list.appendChild(el('div', null, '該当なし')); return; }
      rows.forEach(it => {
        const r = el('div', 'kfm-li');
        const th = el('img', 'kfm-li-th'); th.loading = 'lazy'; th.alt = ''; th.referrerPolicy = 'no-referrer';
        th.src = thumbFor(String(it.asin));
        th.onerror = () => { const alt = `https://images-na.ssl-images-amazon.com/images/P/${it.asin}.09.MZZZZZZZ.jpg`;
          if (th.src !== alt) th.src = alt; else th.style.visibility = 'hidden'; };
        r.appendChild(th);
        const info = el('div', 'kfm-li-i');
        const t = el('a', 'kfm-li-t', it.title || it.asin); t.href = it.keepaUrl || ('https://keepa.com/#!product/5-' + it.asin); t.target = '_blank'; t.rel = 'noopener';
        info.appendChild(t);
        info.appendChild(el('div', 'kfm-li-m', `${it.asin}｜分岐 ${it.breakEven !== '' && it.breakEven != null ? yen(+it.breakEven) : '–'}｜追加 ${fmtDate(it.addedAt)}`));
        if (cfg.listGraph) {
          const g = el('img', 'kfm-li-g'); g.loading = 'lazy'; g.alt = '価格履歴'; g.referrerPolicy = 'no-referrer';
          g.src = 'https://graph.keepa.com/pricehistory.png?asin=' + encodeURIComponent(it.asin) + '&domain=5&salesrank=1&amazon=1&new=1&bb=1&fba=1&fbm=1&range=90&width=400&height=120';
          g.onerror = () => g.remove(); info.appendChild(g);
        }
        const del = el('button', 'kfm-li-d', '削除'); del.type = 'button';
        del.addEventListener('click', async () => { if (await deleteItem(it.asin, it.title)) { const i = items.indexOf(it); if (i >= 0) items.splice(i, 1); draw(); } });
        r.appendChild(info); r.appendChild(del); list.appendChild(r);
      });
    };
    q.addEventListener('input', draw); draw();
  }
  function jstISO() {
    const d = new Date(Date.now() + 9 * 3600e3);
    return d.toISOString().replace(/\.\d{3}Z$/, '+09:00');
  }
  function postJSON(url, auth, body) {
    const headers = { 'Content-Type': 'application/json' }; if (auth) headers.Authorization = auth;
    const xhr = (typeof GM !== 'undefined' && GM.xmlHttpRequest) ? GM.xmlHttpRequest.bind(GM) : (typeof GM_xmlhttpRequest === 'function' ? GM_xmlhttpRequest : null);
    if (xhr) return new Promise(res => {
      try {
        const r = xhr({ method: 'POST', url, headers, data: body, timeout: 20000,
          onload: x => res(x.status >= 200 && x.status < 300), onerror: () => res(false), ontimeout: () => res(false) });
        if (r && typeof r.then === 'function') r.then(x => x && x.status !== undefined && res(x.status >= 200 && x.status < 300), () => res(false));
      } catch (e) { res(false); }
    });
    return fetch(url, { method: 'POST', headers, body, mode: 'cors' }).then(r => r.ok, () => false);
  }
  const sending = new Set();
  function itemOf(d) {
    const txt = id => { const x = d.fields.find(y => y.id === id) || d.all[id]; return x ? x.text : ''; };
    const be = breakEven(d);
    return { asin: d.asin, title: d.title, breakEven: be ? be.N : '', price: be ? be.P : '',
      monthlySold: txt('monthlySold'), rank: txt('SALES_current'), buyBox: txt('BUY_BOX_SHIPPING_current'), newPrice: txt('NEW_current'),
      keepaUrl: 'https://keepa.com/#!product/5-' + d.asin, amazonUrl: 'https://www.amazon.co.jp/dp/' + d.asin, sentAt: jstISO() };
  }
  // v0.0.34: 送った1枚だけバッジと削除ボタンを付ける（一覧は作り直さない）
  function inListCard(c, d) {
    if (c && c.isConnected) { markSent(c, '✓リストにあり'); const a = c.querySelector('.kfm-swacts'); if (a) addDelBtn(a, d, c); rendered = listStamp(); }
    else { rendered = ''; schedule(); }
  }
  async function sendGas(d, c) {
    if (!cfg.gasUrl || !cfg.gasKey) { closeSwipe(); openSettings(); return; }
    sending.add(d.asin);
    const item = itemOf(d);
    if (d.img) rememberImg(d.asin, d.img);
    const r = await gmReq('POST', gasApi(), JSON.stringify({ action: 'add', item, mode: 'reject' }));
    sending.delete(d.asin); closeSwipe();
    if (r && r.ok && !r.duplicate) { listCache.set(d.asin, Object.assign({ addedAt: new Date().toISOString() }, item)); inListCard(c, d); toast('追加しました', true); }
    else if (r && r.duplicate) { if (!listCache.has(d.asin)) listCache.set(d.asin, Object.assign({}, item, { addedAt: r.addedAt })); inListCard(c, d); toast(`すでにリストにあります（追加日: ${fmtDate(r.addedAt)}）`, 'warn'); }
    else { if (r && r.error) console.log('[kfm] send error', r.error); toast('送れませんでした。設定を確かめてください', false); }
  }
  async function sendCard(d, c) {
    if (!d.asin || sending.has(d.asin)) return;
    if (cfg.mode === 'gas') return sendGas(d, c);
    const url = await gv('kfmWebhookUrl', ''), auth = await gv('kfmWebhookAuth', '');
    if (!url) { closeSwipe(); openSettings(); return; }
    const txt = id => { const x = d.fields.find(y => y.id === id) || d.all[id]; return x ? x.text : ''; };
    const be = breakEven(d);
    const payload = {
      asin: d.asin, title: d.title, breakEven: be ? be.N : null, price: be ? be.P : null,
      monthlySold: txt('monthlySold'), rank: txt('SALES_current'), buyBox: txt('BUY_BOX_SHIPPING_current'), newPrice: txt('NEW_current'),
      keepaUrl: 'https://keepa.com/#!product/5-' + d.asin, amazonUrl: 'https://www.amazon.co.jp/dp/' + d.asin, sentAt: jstISO()
    };
    sending.add(d.asin);
    const ok = await postJSON(url, auth, JSON.stringify(payload));
    sending.delete(d.asin);
    closeSwipe();
    if (ok) { rememberSent(d.asin); markSent(c); toast('送りました', true); } else toast('送れませんでした。設定を確かめてください', false);
  }
  function listStamp(keys) { keys = keys || [...cache.keys()].sort((a, b) => a - b); return keys.map(k => { const d = cache.get(k); return k + ':' + d.asin + (d.title ? 't' : '') + (d.img ? 'i' : ''); }).join(',') + '|L' + [...listCache.keys()].sort().join(',') + (listLoaded ? 'y' : 'n') + cfg.mode; }
  function renderList(grid, total) {
    const host = grid.closest('.ag-root-wrapper') || grid;
    let list = document.getElementById('kfm-list');
    if (!list || list.nextElementSibling !== host) { if (!list) { list = el('div'); list.id = 'kfm-list'; } host.before(list); }
    const keys = [...cache.keys()].sort((a, b) => a - b);
    const stamp = listStamp(keys);
    if (stamp === rendered) return;
    if ((swOpen && list.contains(swOpen)) || deleting.size) { clearTimeout(renderList._t); renderList._t = setTimeout(() => { try { schedule(); } catch (e) {} }, 600); return; }   // v0.0.34: 開いたスワイプのボタンを作り直して消さない
    rendered = stamp;
    const keepY = window.scrollY, keepH = list.offsetHeight;   // v0.0.34: 作り直しでページが上に飛ばないよう位置を保つ
    if (keepH) list.style.minHeight = keepH + 'px';
    list.textContent = '';
    padList(list);
    sortBar(list);
    list.appendChild(el('div', 'kfm-status', `${keys.length}${total ? ' / ' + total : ''} 件表示` + (harvesting ? '（読み込み中…）' : '')));
    keys.forEach(k => list.appendChild(card(cache.get(k))));
    resetShift(list);
    clearTimeout(list._mh); list._mh = setTimeout(() => list.style.removeProperty('min-height'), 1500);   // 画像の読み込み中に高さが縮んで上に飛ぶのを防ぐ
    if (Math.abs(window.scrollY - keepY) > 2) window.scrollTo(0, keepY);
  }
  // ---- アクティブなフィルター表示：全セルが未設定の行を隠す（:has の入れ子が使えないためクラス付与のみ）----
  function activeFilterPopup() {
    document.querySelectorAll('.grid-filter-form--view-only').forEach(f => {
      const ov = f.closest('.generalOverlay'); if (ov) ov.classList.add('kfm-afov');
      f.querySelectorAll('.filter-row').forEach(r => {
        const cells = r.querySelectorAll('.filter-range--cell');
        if (!cells.length) return;
        // v0.1.19: 数値が全部空でも、チェック（✓ 在庫切れ など）や他の条件がある行は隠さない
        const extra = [...r.querySelectorAll('.filter--checkbox')].some(x => norm(x.textContent))
          || (() => {   // 数値欄・見出し以外に文字がある（例: サブカテゴリー: ○○）
            let rest = r.textContent || '';
            r.querySelectorAll('.filter-row--label, .filter-range--cell').forEach(x => { rest = rest.split(x.textContent || '').join(' '); });
            return !!norm(rest);
          })();
        kc(r, 'kfm-allinactive', !extra && [...cells].every(c => c.querySelector('.inactive')));
      });
    });
  }
  // ---- 並び替え（Keepa の本物のヘッダーをクリック＝全ページ対象のサーバー側ソート）----
  const SORT_CHIPS = [['monthlySold', '月間販売数'], ['SALES_current', 'ランキング'], ['BUY_BOX_SHIPPING_current', 'Buy Box'], ['NEW_current', '新品価格']];
  let sortDir = 'descending', sorting = false;
  function hdr(id) { const w = document.querySelector('.ag-root-wrapper'); return w && w.querySelector(`.ag-header-cell[col-id="${cssEsc(id)}"]`); }
  function curSort() {
    const w = document.querySelector('.ag-root-wrapper'); if (!w) return null;
    const h = w.querySelector('.ag-header-cell[aria-sort="ascending"], .ag-header-cell[aria-sort="descending"]');
    return h ? { id: h.getAttribute('col-id'), dir: h.getAttribute('aria-sort') } : null;
  }
  const colLabel = id => { const c = liveCols.find(x => x.id === id); return c ? c.label : (COL_LABELS[id] || id); };
  async function sortBy(id, dir) {
    const h = hdr(id); if (!h || sorting) return;
    sorting = true;
    try {
      for (let i = 0; i < 4 && h.getAttribute('aria-sort') !== dir; i++) {
        (h.querySelector('.ag-header-cell-label') || h).click();
        await new Promise(r => setTimeout(r, 400));
      }
    } finally {
      sorting = false;
      cache.clear(); rendered = ''; sig = '';
      window.scrollTo(0, 0);
      setTimeout(schedule, 300);
    }
  }
  function openSheet() {
    if (document.getElementById('kfm-sheet')) return;
    const cs = curSort();
    const sh = el('div'); sh.id = 'kfm-sheet';
    const box = el('div', 'kfm-sh'); sh.appendChild(box);
    const top = el('div', 'kfm-sh-top'); top.appendChild(el('span', null, '並び替え'));
    const dirB = el('button', null, sortDir === 'ascending' ? '昇順 ↑' : '降順 ↓'); dirB.type = 'button';
    dirB.addEventListener('click', e => { e.stopPropagation(); sortDir = sortDir === 'ascending' ? 'descending' : 'ascending'; dirB.textContent = sortDir === 'ascending' ? '昇順 ↑' : '降順 ↓'; });
    const close = el('button', null, '閉じる'); close.type = 'button'; close.addEventListener('click', () => sh.remove());
    const r = el('div'); r.style.display = 'flex'; r.style.gap = '6px'; r.appendChild(dirB); r.appendChild(close); top.appendChild(r); box.appendChild(top);
    const list = el('div', 'kfm-sh-list');
    liveCols.filter(c => hdr(c.id)).forEach(c => {
      const it = el('div', cs && cs.id === c.id ? 'on' : '', c.label + (cs && cs.id === c.id ? (cs.dir === 'ascending' ? ' ↑' : ' ↓') : ''));
      it.addEventListener('click', () => { sh.remove(); sortBy(c.id, sortDir); });
      list.appendChild(it);
    });
    box.appendChild(list);
    sh.addEventListener('click', e => { if (e.target === sh) sh.remove(); });
    document.body.appendChild(sh);
  }
  function sortBar(list) {
    let bar = document.getElementById('kfm-sort');
    if (!bar) { bar = el('div'); bar.id = 'kfm-sort'; }
    if (bar.nextElementSibling !== list) list.before(bar);
    const cs = curSort();
    const key = (cs ? cs.id + cs.dir : '-') + '|' + liveCols.length;
    if (bar.dataset.k === key) return; bar.dataset.k = key;
    bar.textContent = '';
    const main = el('button', 'kfm-sort-main', '並び替え: ' + (cs ? colLabel(cs.id) + (cs.dir === 'ascending' ? ' ↑' : ' ↓') : '標準') + ' ▾');
    main.type = 'button'; main.addEventListener('click', openSheet); bar.appendChild(main);
    SORT_CHIPS.forEach(([id, name]) => {
      if (!hdr(id)) return;
      const on = cs && cs.id === id;
      const b = el('button', on ? 'on' : '', name + (on ? (cs.dir === 'ascending' ? ' ↑' : ' ↓') : '')); b.type = 'button';
      b.addEventListener('click', () => sortBy(id, on ? (cs.dir === 'descending' ? 'ascending' : 'descending') : (id === 'SALES_current' ? 'ascending' : 'descending')));
      bar.appendChild(b);
    });
  }
  // ---- フィルター項目の表示/非表示（ラベル文字列で localStorage に保存）----
  // 保存先: GM ストレージ（主）＋ localStorage ＋ Cookie（小さい場合）。起動時に非同期で読み込み、読み込み前は適用しない。
  const FE_KEY = 'kfmHiddenFilters';
  const normKey = t => norm(String(t || '')
    .replace(/行をリセット|セクションをリセット|リセット/g, '')
    .replace(/[（(][^()（）]*\d[^()（）]*[)）]/g, '')
    .replace(/[?？×☑☐⚠]/g, '')).slice(0, 60);
  let feMem = new Set(), feReady = false;
  const parseSet = v => { try { const a = typeof v === 'string' ? JSON.parse(v) : v; return Array.isArray(a) ? a.map(normKey).filter(Boolean) : []; } catch (e) { return []; } };
  const gmGet = async () => {
    try { if (typeof GM !== 'undefined' && GM.getValue) return await GM.getValue(FE_KEY, null); } catch (e) {}
    try { if (typeof GM_getValue === 'function') return GM_getValue(FE_KEY, null); } catch (e) {}
    return null;
  };
  const gmSet = v => {
    try { if (typeof GM !== 'undefined' && GM.setValue) { GM.setValue(FE_KEY, v); return; } } catch (e) {}
    try { if (typeof GM_setValue === 'function') GM_setValue(FE_KEY, v); } catch (e) {}
  };
  const cookieGet = () => { const m = document.cookie.match(/(?:^|; )kfmHF=([^;]*)/); return m ? decodeURIComponent(m[1]) : null; };
  const cookieSet = v => { const e = encodeURIComponent(v); if (e.length < 3500) document.cookie = `kfmHF=${e}; path=/; max-age=31536000; SameSite=Lax`; };
  (async () => {
    const sources = [await gmGet(), (() => { try { return localStorage.getItem(FE_KEY); } catch (e) { return null; } })(), cookieGet()];
    const first = sources.map(parseSet).find(a => a.length) || [];
    feMem = new Set(first); feReady = true;
    if (first.length) feWrite(feMem, true);   // 3か所に揃える（空なら何も書かない）
    try { schedule(); } catch (e) {}
  })();
  function feWrite(st, explicit) {
    if (!st.size && !explicit) return;          // 明示的に全解除した時以外、空集合は書かない
    const v = JSON.stringify([...st]);
    gmSet(v);
    try { localStorage.setItem(FE_KEY, v); } catch (e) {}
    try { cookieSet(v); } catch (e) {}
  }
  const feGet = () => new Set(feMem);
  const feSet = (st, explicit) => { feMem = new Set([...st].map(normKey).filter(Boolean)); feWrite(feMem, explicit); };
  function rowKey(r) {
    const l = r.querySelector('.filter-row--label,.filter-row--label-extended');
    let t = '';
    if (l) {   // ラベル内の注記・ボタン類（リセット、ツールチップ等）を除いた文字だけ
      const c = l.cloneNode(true);
      c.querySelectorAll('.filter--reset,[class*="reset"],.colorTip,.pointyTip,button,.kfm-fe-x').forEach(e => e.remove());
      t = c.textContent;
    } else {
      const c = r.cloneNode(true);
      c.querySelectorAll('input,select,textarea,.kfm-fe-x,.kfm-vlist,.filter--reset,[class*="reset"]').forEach(e => e.remove());
      t = c.textContent;
    }
    return normKey(t);
  }
  function rowHasValue(r) {
    if ([...r.querySelectorAll('.filter--reset,[class*="reset"]')].some(e => e.offsetParent && !e.classList.contains('kfm-fe-x'))) return true;
    return [...r.querySelectorAll('input,select,textarea')].some(i => {
      if (i.type === 'checkbox' || i.type === 'radio') return i.checked;
      if (i.tagName === 'SELECT') return i.selectedIndex > 0;
      return (i.value || '').trim() !== '';
    }) || !!r.querySelector('.filter-text .ui-autocomplete-input ~ *[class*="tag"], [class*="chip"], [class*="token"]');
  }
  function openHiddenSheet() {
    const old = document.getElementById('kfm-sheet'); if (old) old.remove();
    const sh = el('div'); sh.id = 'kfm-sheet';
    const box = el('div', 'kfm-sh'); sh.appendChild(box);
    const top = el('div', 'kfm-sh-top'); top.appendChild(el('span', null, '非表示中の項目'));
    const close = el('button', null, '閉じる'); close.type = 'button'; close.addEventListener('click', () => sh.remove());
    top.appendChild(close); box.appendChild(top);
    const list = el('div', 'kfm-sh-list'); box.appendChild(list);
    const rows = [...document.querySelectorAll('.filter-row')];
    const fill = () => {
      list.textContent = '';
      const st = feGet();
      if (!st.size) { list.appendChild(el('div', null, '非表示の項目はありません')); return; }
      [...st].forEach(k => {
        const r = rows.find(x => rowKey(x) === k);
        const it = el('div', 'kfm-hrow');
        const nm = el('span', null, k + (r && rowHasValue(r) ? '  ⚠条件あり' : ''));
        if (r && rowHasValue(r)) nm.style.color = '#c62828';
        const b = el('button', null, '表示'); b.type = 'button';
        b.addEventListener('click', e => { e.stopPropagation(); const s2 = feGet(); s2.delete(k); feSet(s2, true); filterEdit(); fill(); });
        it.appendChild(nm); it.appendChild(b); list.appendChild(it);
      });
    };
    fill();
    sh.addEventListener('click', e => { if (e.target === sh) sh.remove(); });
    document.body.appendChild(sh);
  }
  function filterEdit() {
    if (!feReady) return;   // 保存データの読み込み完了まで適用しない
    const rows = [...document.querySelectorAll('.filter-row')].filter(r => !r.closest('.ag-root-wrapper,#kfm-list,.grid-filter-form--view-only,.generalOverlay'));
    if (!rows.length) return;
    const hidden = feGet();
    let bar = document.querySelector('.kfm-fe-bar');
    if (!bar) {
      bar = el('div', 'kfm-fe-bar');
      const ed = el('button', null, '項目を編集'); ed.type = 'button';
      ed.addEventListener('click', () => { const on = document.documentElement.classList.toggle('kfm-fedit'); ed.classList.toggle('on', on); ed.textContent = on ? '編集を終了' : '項目を編集'; filterEdit(); });
      const all = el('button', null, 'すべて表示'); all.type = 'button';
      all.className = 'kfm-fe-all';
      all.addEventListener('click', () => { if (!feGet().size) return; if (confirm('非表示にした項目をすべて表示に戻しますか？')) { feSet(new Set(), true); filterEdit(); } });
      const pill = el('button', 'kfm-fe-pill'); pill.type = 'button';
      pill.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); openHiddenSheet(); });
      const warn = el('div', 'kfm-fe-warn', '⚠ 非表示の項目に条件が入っています');
      bar.appendChild(ed); bar.appendChild(all); bar.appendChild(pill); bar.appendChild(warn);
      rows[0].parentElement.insertBefore(bar, rows[0]);
    }
    const editing = document.documentElement.classList.contains('kfm-fedit');
    rows.forEach(r => {
      const k = rowKey(r); if (!k) return;
      const hid = hidden.has(k);
      r.classList.toggle('kfm-rowhidden', hid);
      let x = r.querySelector(':scope > .kfm-fe-x');
      if (!x) {
        x = el('button', 'kfm-fe-x'); x.type = 'button';
        x.addEventListener('click', e => { e.preventDefault(); e.stopPropagation();
          const st = feGet(); const kk = rowKey(r); if (st.has(kk)) st.delete(kk); else st.add(kk); feSet(st, true); filterEdit(); });
        r.appendChild(x);
      }
      x.textContent = editing ? (hid ? '☐' : '☑') : '×';
      x.setAttribute('aria-label', hid ? '表示する' : '非表示にする');
    });
    // 非表示中の件数と、非表示項目に条件が入っているかを表示
    const hidRows = rows.filter(r => r.classList.contains('kfm-rowhidden'));
    const active = hidRows.filter(rowHasValue);
    const pill = bar.querySelector('.kfm-fe-pill');
    pill.textContent = '👁 非表示中の項目 ' + hidRows.length + '件';
    pill.style.display = hidRows.length ? '' : 'none';
    bar.querySelector('.kfm-fe-warn').style.display = active.length ? '' : 'none';
    rows.forEach(r => r.classList.toggle('kfm-rowwarn', active.includes(r)));
    document.querySelectorAll('.kfm-search').forEach(b => b.classList.toggle('kfm-warn', active.length > 0));
  }
  // ---- 自前のページ送りバー（Keepa の本物のボタンにクリックを中継）----
  function pgButtons(panel) {
    const by = r => panel.querySelector(`[ref="${r}"], [data-ref="${r}"]`);
    let b = [by('btFirst'), by('btPrevious'), by('btNext'), by('btLast')];
    if (b.some(x => !x)) { const all = [...panel.querySelectorAll('.ag-paging-button, [role="button"]')]; if (all.length >= 4) b = all.slice(0, 4); }
    return b;
  }
  const isDis = b => !b || b.classList.contains('ag-disabled') || b.getAttribute('aria-disabled') === 'true' || b.disabled;
  function bottomBarH() { const bb = document.querySelector('.kfm-bottombar'); if (!bb) return 0; const r = bb.getBoundingClientRect(); return r.height && r.bottom > 0 ? r.height : 0; }
  function padList(list) {
    const pg = document.getElementById('kfm-pager');
    const r = pg && pg.getBoundingClientRect();
    const used = r && r.height ? Math.max(r.height + bottomBarH(), window.innerHeight - r.top) : 0;   // v0.1.5: 浮いたバーの下の余白も含める
    list.style.paddingBottom = Math.ceil(used + 20) + 'px';
  }
  // v0.1.10: 件数はまず2行（10px以上）を優先。ページャーが隠れているときは測らない
  function pagerVisible() {
    const pg = document.getElementById('kfm-pager');
    if (!pg) return false;
    if (!finderResultsViewActive()) return false;
    if (document.documentElement.classList.contains('kfm-ac-open')) return false;
    if (document.getElementById('kfm-cols')) return false;
    const st = getComputedStyle(pg);
    if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) return false;
    const r = pg.getBoundingClientRect();
    return r.width > 40 && r.height > 20;
  }
  // v0.1.13: Keepa の件数テキストを a–b / N件 に整形。総数は summary か .finder-query--results
  function finderResultTotal() {
    const elr = document.querySelector('.finder-query--results');
    if (!elr) return '';
    const m = norm(elr.textContent).match(/([\d,]+)\s*(?:商品|products?|results?|items?)/i);
    return m ? m[1].replace(/,/g, '') : '';
  }
  function parsePagerRange(rawSum) {
    const raw = norm(rawSum);
    if (!raw) return null;
    // "1 から 100 / 6411" | "1 to 100 of 6,411" | "1–100 of 6411" | "1 から 100 / more"
    let m = raw.match(/([\d,]+)\s*(?:から|to|–|-|—)\s*([\d,]+)\s*(?:\/|of)\s*([\d,]+|more|以上)/i);
    if (!m) m = raw.match(/([\d,]+)\s*[–-]\s*([\d,]+)\s*(?:\/|of)\s*([\d,]+|more)/i);
    if (m) {
      const tot = /^more$/i.test(m[3]) || m[3] === '以上' ? '' : m[3].replace(/,/g, '');
      return { a: m[1].replace(/,/g, ''), b: m[2].replace(/,/g, ''), tot };
    }
    const nums = raw.match(/[\d,]+/g) || [];
    if (nums.length >= 3) return { a: nums[0].replace(/,/g, ''), b: nums[1].replace(/,/g, ''), tot: nums[2].replace(/,/g, '') };
    if (nums.length >= 2) return { a: nums[0].replace(/,/g, ''), b: nums[1].replace(/,/g, ''), tot: '' };
    return null;
  }
  function fitCount(se, n) {
    if (!se || !n || n.length < 2) return;
    const pg = se.closest('#kfm-pager');
    const box = se.parentElement || se;
    const a = String(n[0]).replace(/,/g, ''), b = String(n[1]).replace(/,/g, '');
    const rawTot = n.length >= 3 ? String(n[2]).replace(/,/g, '') : '';
    const isMore = !rawTot || /^more$/i.test(rawTot);
    const tot = isMore ? 'more' : rawTot;
    // v0.1.13: 必ず先に2行を書く（測れなくても生テキストを残さない）
    const set = (...parts) => { se.textContent = ''; parts.forEach(txt => se.appendChild(el('span', null, txt))); };
    const line2 = isMore ? '/ more' : `/ ${tot}件`;
    set(`${a}–${b}`, line2);
    se.style.fontSize = '12px'; se.style.lineHeight = '1.25';
    if (!pagerVisible() || !box.clientWidth) return;
    const fits = () => [...se.children].every(c => c.scrollWidth <= box.clientWidth + 0.5)
      && se.scrollHeight <= (pg || box).clientHeight + 0.5;
    const line2opts = isMore ? ['/ more', '/more'] : [`/ ${tot}件`, `/${tot}件`];
    const two = [[`${a}–${b}`, line2opts[0]], [`${a}–${b}`, line2opts[1]]];
    for (const row of two) {
      set(...row);
      for (let f = 12; f >= 11; f -= 0.5) {
        se.style.fontSize = f + 'px'; se.style.lineHeight = '1.25';
        if (fits()) return;
      }
    }
    for (const row of two) {
      set(...row);
      for (let f = 10.5; f >= 9; f -= 0.5) {
        se.style.fontSize = f + 'px'; se.style.lineHeight = '1.2';
        if (fits()) return;
      }
    }
    // v0.1.13: 常に2行（a–b / N件）。3行フォールバックは使わない
    set(`${a}–${b}`, isMore ? '/ more' : `/ ${tot}件`);
    for (let f = 11; f >= 8; f -= 0.5) {
      se.style.fontSize = f + 'px'; se.style.lineHeight = '1.15';
      if (fits()) return;
    }
    se.style.fontSize = '8px'; se.style.lineHeight = '1.1';
  }
  function refitPagerCount() {
    // v0.1.13: resize でも summary を再パース（ページ番号補正を含める）
    const w = document.querySelector('.ag-root-wrapper');
    if (w) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => { try { updatePager(w); } catch (e) {} });
      });
      return;
    }
    const se = document.querySelector('#kfm-pager .kfm-pg-sum');
    if (!se || !se.dataset.k) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!pagerVisible()) return;
        fitCount(se, se.dataset.k.split('|').map(x => x.replace(/,/g, '')));
      });
    });
  }
  window.addEventListener('resize', () => { if (kfmWidthChanged('pg')) refitPagerCount(); });
  // v0.1.13: summary / 商品数の文字変化のたび再整形（body MO は characterData を見ていない）
  let sumWatchMO = null, sumWatchEl = null, sumWatchT = 0;
  // v0.1.14: 結果一覧表示中だけページャーを出す（フィルター画面の #grid-form-finder が display:none のとき）
  function finderResultsViewActive() {
    const form = document.getElementById('grid-form-finder');
    if (form) {
      // v0.1.18: 再読み込み直後は中身が空のフォームが display:block のまま残る（結果一覧なのにページャーが出なかった）。中身があるときだけフィルター画面とみなす
      try { if (getComputedStyle(form).display !== 'none' && form.childElementCount > 0) return false; } catch (e) {}
    }
    const data = document.querySelector('.data-container');
    if (data) {
      try { if (Number(getComputedStyle(data).opacity) === 0) return false; } catch (e) {}
    }
    return true;
  }
  function armPagerSumWatch(sumEl) {
    const resEl = document.querySelector('.finder-query--results');
    const panel = document.querySelector('.ag-paging-panel');
    const lbCur = panel && panel.querySelector('[ref=lbCurrent], [data-ref=lbCurrent]');
    const lbTot = panel && panel.querySelector('[ref=lbTotal], [data-ref=lbTotal]');
    const form = document.getElementById('grid-form-finder');
    const data = document.querySelector('.data-container');
    const targets = [sumEl, resEl, lbCur, lbTot].filter(Boolean);
    const attrTargets = [form, data].filter(Boolean);
    if (!targets.length && !attrTargets.length) return;
    if (!sumWatchMO) {
      sumWatchMO = new MutationObserver(() => {
        clearTimeout(sumWatchT);
        sumWatchT = setTimeout(() => {
          const w = document.querySelector('.ag-root-wrapper');
          if (w) updatePager(w);
        }, 30);
      });
    }
    // 付け直し（要素が差し替わるため）
    try { sumWatchMO.disconnect(); } catch (e) {}
    targets.forEach(t => {
      try { sumWatchMO.observe(t, { characterData: true, childList: true, subtree: true }); } catch (e) {}
    });
    // フィルター↔結果の切替は style.display / opacity の変化
    attrTargets.forEach(t => {
      try { sumWatchMO.observe(t, { attributes: true, attributeFilter: ['style', 'class'], childList: t === form }); } catch (e) {}
    });
    sumWatchEl = sumEl;
  }
  function updatePager(wrap) {
    const panel = wrap.querySelector('.ag-paging-panel');
    let pg = document.getElementById('kfm-pager');
    if (!panel) { if (pg) pg.remove(); return; }
    // v0.1.14: フィルター画面では隠す（結果一覧のときだけ表示）
    if (!finderResultsViewActive()) {
      if (pg) { pg.style.display = 'none'; pg.setAttribute('aria-hidden', 'true'); }
      const l = document.getElementById('kfm-list'); if (l) l.style.paddingBottom = '';
      return;
    }
    if (pg) { pg.style.display = ''; pg.removeAttribute('aria-hidden'); }
    if (!pg) {
      pg = el('div'); pg.id = 'kfm-pager';
      pg.innerHTML = '<div class="kfm-pg-info"><span class="kfm-pg-sum"></span><span class="kfm-pg-ver"></span></div><button type="button" class="kfm-pg-set" aria-label="送信設定" title="送信設定"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg></button><button type="button" class="kfm-pg-trk" aria-label="トラッキング整理" title="トラッキング整理">'+ICON_BROOM.replace(/20/g,'18')+'</button><button type="button" class="kfm-pg-list" aria-label="あとで見るリスト" title="あとで見るリスト"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z"/></svg></button>' +
        '<div class="kfm-pg-ctl"><button type="button" aria-label="最初のページ">«</button><button type="button" aria-label="前のページ">‹</button>' +
        '<span class="kfm-pg-num"></span><button type="button" aria-label="次のページ">›</button><button type="button" aria-label="最後のページ">»</button></div>';
      { const grp = el('div', 'kfm-pg-icons');   // v0.1.4: 3つのアイコンを1つの組にし、同じ箱・同じ線で揃える
        ['.kfm-pg-set', '.kfm-pg-trk', '.kfm-pg-list'].forEach(q => { const b = pg.querySelector(q); if (!b) return; grp.appendChild(b);
          const sv = b.querySelector('svg'); if (sv) { sv.setAttribute('width', '18'); sv.setAttribute('height', '18'); sv.setAttribute('viewBox', '0 0 24 24');
            sv.setAttribute('stroke', 'currentColor'); sv.setAttribute('stroke-width', '2'); sv.setAttribute('stroke-linecap', 'round'); sv.setAttribute('stroke-linejoin', 'round'); } });
        pg.querySelector('.kfm-pg-ctl').before(grp); }
      document.body.appendChild(pg); applyHand();
      pg.querySelector('.kfm-pg-trk').addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); location.hash = '#!manage'; });
      pg.querySelector('.kfm-pg-list').addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); openListSheet(); });
      pg.querySelector('.kfm-pg-set').addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); openSettings(); });
      [...pg.querySelectorAll('.kfm-pg-ctl button')].forEach((btn, i) => btn.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        const w = document.querySelector('.ag-root-wrapper'); const pnl = w && w.querySelector('.ag-paging-panel'); if (!pnl) return;
        const kb = pgButtons(pnl)[i]; if (isDis(kb)) return;
        kb.click();
        const l = document.getElementById('kfm-list'); if (l) window.scrollTo(0, Math.max(0, l.getBoundingClientRect().top + window.scrollY - 60));
        setTimeout(schedule, 50);
      }));
    }
    const sumEl = panel.querySelector('.ag-paging-row-summary-panel');
    const rawSum = sumEl ? norm(sumEl.textContent) : '';
    armPagerSumWatch(sumEl);
    { const se = pg.querySelector('.kfm-pg-sum');
      const parsed = parsePagerRange(rawSum);
      if (parsed) {
        let tot = parsed.tot;
        if (!tot) tot = finderResultTotal();   // summary が more でもファインダー表示の総数を使う
        let a = parsed.a, b = parsed.b;
        // Keepa summary がページ送り後も "1 から 100" のまま残ることがある → 現在ページから補正
        if (tot && tot !== 'more') {
          const st = pgState(panel);
          const cur = st.cur | 0;
          const span = Math.max(1, (+b || 0) - (+a || 0) + 1);
          if (cur > 1 && +a === 1) {
            a = String((cur - 1) * span + 1);
            b = String(Math.min(+a + span - 1, +tot));
          }
        }
        const parts = [a, b, tot || 'more'];
        se.dataset.k = parts.join('|'); fitCount(se, parts);
      } else {
        // v0.1.13: 生テキストは出さない（読み込み中など）
        delete se.dataset.k; se.textContent = '';
      } }
    const desc = panel.querySelector('.ag-paging-description');
    const pn = (desc ? norm(desc.textContent) : norm(panel.textContent)).match(/(\d[\d,]*)\s*\/\s*(\d[\d,]*)\s*$/) ||
      (desc ? norm(desc.textContent) : '').match(/(\d[\d,]*)\D+(\d[\d,]*)/);
    pg.querySelector('.kfm-pg-num').textContent = pn ? `${pn[1]} / ${pn[2]}` : '';
    pg.querySelector('.kfm-pg-ver').textContent = VERSION;
    const kbs = pgButtons(panel);
    [...pg.querySelectorAll('.kfm-pg-ctl button')].forEach((b, i) => { b.disabled = isDis(kbs[i]); });
    const bh = bottomBarH();
    pg.style.bottom = `calc(${bh}px + 10px + ${bh ? '0px' : 'env(safe-area-inset-bottom)'})`;   // v0.1.5: 浮かせて下端・Safariのバーから離す
    pg.classList.toggle('kfm-pg-solo', !bh);
    const l = document.getElementById('kfm-list'); if (l) padList(l);
  }
  // ---- v0.1.3: 製品ファインダーのページと表示位置を覚えて戻す（Keepa本物のページ送りボタンを押すだけ）----
  const POS_KEY = 'kfmFinderPos';
  const posGet = () => { try { return JSON.parse(sessionStorage.getItem(POS_KEY) || 'null'); } catch (e) { return null; } };
  const posSet = v => { try { if (v) sessionStorage.setItem(POS_KEY, JSON.stringify(v)); else sessionStorage.removeItem(POS_KEY); } catch (e) {} };
  function pgState(panel) {
    const t = r => { const e = panel.querySelector(`[ref="${r}"], [data-ref="${r}"]`); return e ? +norm(e.textContent).replace(/,/g, '') : 0; };
    let cur = t('lbCurrent'), pages = t('lbTotal');
    if (!cur) { const d = panel.querySelector('.ag-paging-description'); const m = norm(d ? d.textContent : '').match(/(\d[\d,]*)\D+(\d[\d,]*)/); if (m) { cur = +m[1].replace(/,/g, ''); pages = +m[2].replace(/,/g, ''); } }
    const s = panel.querySelector('.ag-paging-row-summary-panel'); const n = (s ? norm(s.textContent) : '').match(/[\d,]+/g) || [];
    return { cur, pages, total: n.length >= 3 ? n[2] : '' };
  }
  let posRestore = null;      // 戻し中の状態
  let posArmed = true;        // 読み込み直後・ファインダーに戻ったとき
  let posHideAt = 0;
  const posHide = on => {   // 戻し中は途中のページを見せない
    const root = document.documentElement;
    if (!root) return;   // document-start で html 未準備のことがある
    if (on && !root.classList.contains('kfm-restoring')) posHideAt = Date.now();
    kc(root, 'kfm-restoring', !!on);
  };
  const posPending = () => { const r = posGet(); return !!(r && r.hash === location.hash && (r.page > 1 || r.asin || r.y)); };
  if (document.documentElement && onFinder() && posPending()) posHide(true);
  setInterval(() => { if ((!posRestore && !posArmed) || !onFinder() || Date.now() - posHideAt > 20000) posHide(false); }, 1000);   // 見張り: 隠したままにしない
  let posSaveT = 0;
  function posPanel() { const w = document.querySelector('.ag-root-wrapper'); return w && w.querySelector('.ag-paging-panel'); }
  function posSave() {
    if (!onFinder() || posRestore || posArmed) return;
    const panel = posPanel(), list = document.getElementById('kfm-list'); if (!panel || !list) return;
    const st = pgState(panel); if (!st.cur) return;
    let asin = '', off = 0;
    for (const c of list.querySelectorAll('.kfm-c[data-asin]')) { const r = c.getBoundingClientRect(); if (r.bottom > 60) { asin = c.dataset.asin; off = Math.round(r.top); break; } }
    posSet({ hash: location.hash, page: st.cur, total: st.total, asin, off, y: Math.round(window.scrollY) });
  }
  const posSaveSoon = () => { clearTimeout(posSaveT); posSaveT = setTimeout(posSave, 400); };
  window.addEventListener('scroll', () => { if (onFinder() && !posRestore) posSaveSoon(); }, { passive: true });
  window.addEventListener('pagehide', () => { if (onFinder()) posSave(); });
  window.addEventListener('hashchange', () => { if (onFinder()) { posArmed = true; posRestore = null; posHide(posPending()); } else posHide(false); });
  const posCancel = () => { if (posRestore) { posRestore = null; posHide(false); posSaveSoon(); } };
  ['touchstart', 'wheel', 'keydown', 'mousedown'].forEach(ev => window.addEventListener(ev, e => { if (e.isTrusted) posCancel(); }, { passive: true, capture: true }));
  function posTick() {
    if (!onFinder()) return;
    const panel = posPanel(); if (!panel) return;
    const st = pgState(panel); if (!st.cur) return;
    if (posArmed) {
      posArmed = false;
      const rec = posGet();
      if (!rec || rec.hash !== location.hash || (rec.total && st.total && rec.total !== st.total)) { posSet(null); posHide(false); posSaveSoon(); return; }   // 別の検索・条件変更
      if (rec.page <= 1 && !rec.asin && !rec.y) { posHide(false); posSaveSoon(); return; }
      posHide(true);
      posRestore = { rec, t0: Date.now(), clickAt: 0, lastCur: 0 };
    }
    const R = posRestore; if (!R) { posHide(false); posSaveSoon(); return; }
    if (Date.now() - R.t0 > 20000) { posRestore = null; posHide(false); return; }   // あきらめる
    if (st.cur !== R.rec.page) {
      if (st.cur === R.lastCur && Date.now() - R.clickAt < 1500) return;   // ページ切替の待ち
      const b = pgButtons(panel), want = st.cur < R.rec.page ? 2 : 1;
      if (R.rec.page === 1) { if (!isDis(b[0])) b[0].click(); }
      else if (R.rec.page === st.pages && !isDis(b[3])) b[3].click();
      else if (!isDis(b[want])) b[want].click(); else { posRestore = null; posHide(false); return; }
      R.lastCur = st.cur; R.clickAt = Date.now(); [80, 200, 400].forEach(t => setTimeout(schedule, t)); return;
    }
    const list = document.getElementById('kfm-list'); if (!list) return;
    const card = R.rec.asin && list.querySelector(`.kfm-c[data-asin="${cssEsc(R.rec.asin)}"]`);
    if (card) { posRestore = null; requestAnimationFrame(() => posHide(false)); window.scrollTo(0, Math.max(0, card.getBoundingClientRect().top + window.scrollY - (R.rec.off || 0))); setTimeout(posSaveSoon, 600); return; }
    if (Date.now() - R.t0 > 8000 || (!R.rec.asin && list.querySelector('.kfm-c'))) { posRestore = null; if (R.rec.y) window.scrollTo(0, R.rec.y); requestAnimationFrame(() => posHide(false)); return; }
    if (Date.now() - R.t0 > 3000 && cache.size < 3) harvest(document.querySelector('.ag-root-wrapper'));
    setTimeout(schedule, 250);
  }
  function leaveFinder() {
    ['kfm-sort', 'kfm-sheet', 'kfm-cols', 'kfm-ac-done'].forEach(i => { const e = document.getElementById(i); if (e && !(i === 'kfm-sheet' && onManage())) e.remove(); }); kc(document.documentElement, 'kfm-cols-open', false);
    const pg = document.getElementById('kfm-pager'); if (pg) pg.remove();
    document.querySelectorAll('.kfm-gridhost').forEach(w => w.classList.remove('kfm-gridhost'));
    const l = document.getElementById('kfm-list'); if (l) l.remove();
    cache.clear(); rendered = ''; sig = ''; harvesting = false;
  }
  function leaveProduct() {
    /* product styles are class-scoped; nothing to undo beyond class toggle */
  }
  function cardify() {
    const wrap = document.querySelector('.ag-root-wrapper');
    if (!onFinder()) { leaveFinder(); return; }
    if (!wrap) { const l = document.getElementById('kfm-list'); if (l) l.remove(); return; }
    wrap.classList.add('kfm-gridhost');
    try { posTick(); } catch (e) {}
    if (harvesting) return;
    const firstAsin = (() => { const c = wrap.querySelector('.ag-center-cols-container .ag-row[row-index="0"] .ag-cell[col-id="asin"]'); return c ? norm(c.textContent) : ''; })();
    const ns = location.hash.split('/')[0] + '|' + pagingText(wrap) + '|' + rowCount(wrap);
    if (ns !== sig || (firstAsin && cache.has(0) && cache.get(0).asin !== firstAsin)) { sig = ns; cache.clear(); rendered = ''; if (cfg.mode === 'gas') refreshList(); }
    const total = rowCount(wrap);
    collect(wrap); renderList(wrap, total); updatePager(wrap); try { posTick(); } catch (e) {}
    if (total && cache.size < total && !isTyping() && !posRestore) harvest(wrap).then(() => renderList(wrap, total));
    // v0.1.11: 結果ツールバーだけ印付け（高度なフィルター見出しには触らない）
    document.querySelectorAll('.kfm-toolbar, .kfm-toolbar-anc, .kfm-tools, .kfm-tools-row').forEach(e => {
      if (e.closest('.grid-wrapper-tools')) return;
      e.classList.remove('kfm-toolbar', 'kfm-toolbar-anc', 'kfm-tools', 'kfm-tools-row');
    });
    const toolsWrap = document.querySelector('.grid-wrapper-tools');
    if (toolsWrap && !toolsWrap.closest('.ag-root,#kfm-list')) {
      toolsWrap.classList.add('kfm-tools');
      const row = toolsWrap.querySelector(':scope > div');
      if (row) row.classList.add('kfm-tools-row');
    }
    compactTools();
  }
  function compactTools() {
    if (!mq.matches || !onFinder()) return;
    const map = [
      [/^列を設定/, '列'],
      [/^列にジャンプ/, 'ジャンプ'],
      [/^\d+\s*行/, m => (m[0] || '').replace(/\s+/g, '')],
      [/^エクスポート/, '書出'],
      [/^検索インサイト/, '分析'],
      [/^API\s*クエリ/, 'API'],
      [/^用語集/, '用語']
    ];
    document.querySelectorAll('.grid-wrapper-tools.kfm-tools .trigger, .grid-wrapper-tools.kfm-tools .tool__column, .grid-wrapper-tools.kfm-tools .tool__jumpcolumn, .grid-wrapper-tools.kfm-tools .tool__glossary').forEach(el => {
      const tEl = el.classList.contains('trigger') ? el : el.querySelector('.trigger') || el;
      if (!tEl || tEl.dataset.kfmShort) return;
      const raw = norm(tEl.textContent);
      for (const [re, to] of map) {
        const m = raw.match(re);
        if (!m) continue;
        const label = typeof to === 'function' ? to(m) : to;
        const icon = tEl.querySelector('i.fa, i[class*="fa"], svg');
        const ic = icon ? icon.cloneNode(true) : null;
        tEl.dataset.kfmShort = '1'; el.dataset.kfmShort = '1';
        tEl.textContent = '';
        if (ic) tEl.appendChild(ic);
        tEl.appendChild(document.createTextNode('\u2002' + label));
        break;
      }
    });
  }

  // ---------- filters ----------
  function findByText(words, root = document.body) {
    const out = [];
    root.querySelectorAll('button,a,span,div,h1,h2,h3,h4,label,td').forEach(el => {
      if (el.children.length > 2) return;
      const t = norm(el.textContent);
      if (t && t.length < 40 && words.some(w => t === w || t.startsWith(w))) out.push(el);
    });
    return out;
  }
  function sectionize() {
    SECTION_TITLES.forEach(title => {
      document.querySelectorAll('h1,h2,h3,h4,h5,div,span,legend,td').forEach(h => {
        if (h.dataset.kfmSec || h.closest('.kfm-toggle,.ag-root-wrapper')) return;
        const t = norm(h.textContent);
        if (!(t === title || t.replace(/[！!]/g, '') === title)) return;
        if (h.querySelector('input,select')) return;
        // container = nearest ancestor that also contains filter rows
        let c = h.parentElement;
        while (c && c !== document.body && !c.querySelector('.filter-row,.filter-range,.filter-text')) c = c.parentElement;
        if (!c || c === document.body || c.classList.contains('kfm-section')) return;
        h.dataset.kfmSec = '1';
        c.classList.add('kfm-section');
        const btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'kfm-toggle';
        const set = () => btn.textContent = (c.classList.contains('kfm-collapsed') ? '▸ ' : '▾ ') + title;
        btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); c.classList.toggle('kfm-collapsed'); set(); });
        c.prepend(btn);
        if (COLLAPSE_SECTIONS) c.classList.add('kfm-collapsed');
        set();
      });
    });
  }
  function bottomBar() {
    const s = document.getElementById('filterSubmit')
      || findByText(['製品を探す']).find(el => /button|a/i.test(el.tagName) || el.onclick || el.getAttribute('role') === 'button')
      || findByText(['製品を探す'])[0];
    if (!s) return;
    s.classList.add('kfm-search');
    let bar = s.closest('.filter-actions');
    if (!bar) {
      bar = s.parentElement;
      for (let i = 0; bar && i < 4; i++) {
        const t = norm(bar.textContent);
        if (t.includes('フィルタービルダー') || t.includes('API クエリ') || t.includes('APIクエリ') || t.includes('フィルターへジャンプ')) break;
        bar = bar.parentElement;
      }
    }
    // v0.1.24: 文字数制限を外す。Keepa が .content-jump に全フィルター名を入れると 200 字を超え、
    // kfm-bottombar も折りたたみボタンも付かず、本体の position:sticky のままになる
    if (bar && bar !== document.body) { kc(bar, 'kfm-bottombar', true); bbToggle(bar); }
  }
  // ---- v0.1.21: 下のパネルを畳める（畳むと「製品を探す」と件数だけ）。状態は覚えておく ----
  let bbRO = null, bbObs = null;
  function bbSetH(bar) {
    const h = Math.ceil(bar.getBoundingClientRect().height || 0);
    if (h && document.documentElement.style.getPropertyValue('--kfm-bbh') !== h + 'px') document.documentElement.style.setProperty('--kfm-bbh', h + 'px');
  }
  function bbApply(bar, min, anim) {
    const H = document.documentElement;
    if (H.classList.contains('kfm-bb-min') === min) return;
    const from = anim ? bar.getBoundingClientRect().height : 0;
    kc(H, 'kfm-bb-min', min);
    const b = bar.querySelector('#kfm-bb-tog');
    if (b) { b.setAttribute('aria-expanded', String(!min)); b.setAttribute('aria-label', min ? 'パネルを広げる' : 'パネルを畳む'); }
    try { document.cookie = 'kfmBbMin=' + (min ? '1' : '0') + '; max-age=31536000; path=/; SameSite=Lax'; } catch (e) {}   // Keepa は読み込み時に localStorage を消すので cookie に
    if (anim && from && bar.animate) {
      const to = bar.getBoundingClientRect().height;
      if (Math.abs(to - from) > 2) {
        // 高さを変えるのではなく下からずらす（再レイアウトなしで滑らか）
        bar.animate([{ transform: `translateY(${to - from}px)` }, { transform: 'translateY(0)' }], { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' });
      }
    }
    bbSetH(bar);
  }
  function bbToggle(bar) {
    if (!bar.querySelector('#kfm-bb-tog')) {
      const b = el('button'); b.type = 'button'; b.id = 'kfm-bb-tog';
      b.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
      b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); bbApply(bar, !document.documentElement.classList.contains('kfm-bb-min'), true); });
      bar.appendChild(b);
      let min = false; try { min = /(?:^|;\s*)kfmBbMin=1(?:;|$)/.test(document.cookie); } catch (e) {}
      kc(document.documentElement, 'kfm-bb-min', !min);   // bbApply が必ず反映するように逆にしてから
      bbApply(bar, min, false);
    }
    if (bbObs !== bar && window.ResizeObserver) {
      if (bbRO) bbRO.disconnect();
      bbRO = new ResizeObserver(() => bbSetH(bar)); bbRO.observe(bar); bbObs = bar;
    }
    bbSetH(bar);
  }

  let badgeShown = false;
  function badge() {
    if (badgeShown || sessionStorage.getItem('kfmBadgeOff')) return; badgeShown = true;
    const b = document.createElement('div'); b.id = 'kfm-badge'; b.textContent = 'スマホ表示 ON';
    const x = document.createElement('b'); x.textContent = '×';
    x.addEventListener('click', () => { sessionStorage.setItem('kfmBadgeOff', '1'); b.remove(); });
    b.appendChild(x); document.body.appendChild(b);
    setTimeout(() => { b.style.opacity = '0'; setTimeout(() => b.remove(), 600); }, 3000);
  }
  function pairChecks() {
    document.querySelectorAll('.filter-row input[type=checkbox]').forEach(cb => {
      const p = cb.parentElement;
      if (!p || p.classList.contains('kfm-checkpair')) return;
      if (p.querySelectorAll('input[type=checkbox]').length === 1 && norm(p.textContent).length < 40) {
        p.classList.add('kfm-checkpair'); if (p.parentElement) p.parentElement.classList.add('kfm-checks');
      } else p.classList.add('kfm-checks');
    });
  }
  const DEBUG = FORCE_DEBUG || /kfmdebug/i.test(location.href);
  const cbCount = el => el.querySelectorAll('input[type=checkbox]').length;
  function pairOf(cb) {
    const lab = cb.closest('label');
    if (lab && cbCount(lab) === 1) return lab;
    let el = cb;
    while (el.parentElement && cbCount(el.parentElement) === 1 &&
           !el.parentElement.querySelector('.filter-range,.filter-row--label,.filter-row--label-extended') &&
           norm(el.parentElement.textContent).length <= norm(el.textContent).length + 30) el = el.parentElement;
    if (el === cb || !norm(el.textContent)) {               // チェック＋直後のテキストを包む
      const w = document.createElement('span'); w.className = 'kfm-pair';
      cb.parentNode.insertBefore(w, cb);
      let n = cb, list = [];
      while (n) { const nx = n.nextSibling; list.push(n);
        if (nx && nx.nodeType === 1 && (nx.matches('input[type=checkbox]') || cbCount(nx))) break; n = nx;
        if (list.length > 6) break; }
      list.forEach(x => w.appendChild(x));
      return w;
    }
    return el;
  }
  function rowOf(pair) {
    let r = pair.parentElement;
    while (r && r !== document.body) {
      if (r.querySelector('.filter-range,.filter-row--label,.filter-row--label-extended') || r.classList.contains('filter-row') || cbCount(r) > 1 && norm(r.textContent).length > 0 && r.querySelector('.colorTip,.pointyTip,[title]')) return r;
      r = r.parentElement;
    }
    return pair.parentElement;
  }
  function groupChecks() {
    const rows = new Map();
    document.querySelectorAll('input[type=checkbox]').forEach(cb => {
      if (cb.closest('.kfm-vlist,.ag-root-wrapper,#kfm-badge,.kfm-bottombar,#kfm-sheet,#kfm-tm,#kfm-tm-sheet,.content-column,.column-group,#kfm-cols,.ui-autocomplete,.filter-text--autocomplete')) return;
      if (cb.closest('.filter-row') && cb.closest('.filter-row').querySelector('.ui-autocomplete-input,.filter-text')) return;
      const pair = pairOf(cb); const row = rowOf(pair);
      if (row.querySelector('.ui-autocomplete-input,.filter-text,.ui-front')) return;
      if (!rows.has(row)) rows.set(row, []);
      rows.get(row).push(pair);
    });
    rows.forEach((pairs, row) => {
      let list = row.querySelector(':scope > .kfm-vlist');
      const oldParents = new Set(pairs.map(p => p.parentElement));
      let branch = pairs[0]; while (branch.parentElement && branch.parentElement !== row) branch = branch.parentElement;
      const lab = row.querySelector('.filter-row--label,.filter-row--label-extended') ||
        [...row.children].find(c => c !== branch && !cbCount(c) && norm(c.textContent));
      if (lab) lab.classList.add('kfm-rowlabel');
      if (!list) {
        list = document.createElement('div'); list.className = 'kfm-vlist'; list.dataset.kfm = '1';
        if (lab && lab.parentElement === row) lab.after(list);
        else if (branch.parentElement === row) branch.after(list);
        else row.prepend(list);
      }
      pairs.forEach(p => list.appendChild(p));
      oldParents.forEach(op => { if (op && op !== row && !norm(op.textContent) && !op.querySelector('input,select,img,button')) op.classList.add('kfm-emptied'); });
      if (DEBUG) console.log('[kfm] row', row, 'label', lab, 'pairs', pairs.map(p => norm(p.textContent)));
    });
  }
  // 日付・その他スタイル違いの範囲欄を一括で数値欄と同じ見た目に
  const FROMTO = /^(から|まで)$/;
  function fixRanges() {
    const fields = document.querySelectorAll('.filter-range--field, .filter-range--seg');
    let ref = null;
    fields.forEach(f => {
      if (ref || /-date/.test(f.className)) return;
      const inp = f.querySelector('input'); if (inp && inp.type === 'text' && inp.placeholder && FROMTO.test(inp.placeholder.trim())) ref = f;
    });
    fields.forEach(f => {
      if (f === ref || f.classList.contains('kfm-datefix') || f.closest('.filter-text,.ui-front') || f.querySelector('.ui-autocomplete-input')) return;
      const inp = f.querySelector('input'); if (!inp) return;
      const lab = [...f.querySelectorAll('span,label,div')].find(e => !e.querySelector('input') && FROMTO.test(norm(e.textContent)));
      const isDate = /-date/.test(f.className) || /date|month/i.test(inp.type) || inp.classList.contains('hasDatepicker');
      if (!isDate && !lab) return;
      if (lab && !isDate) {          // ラベルが別要素：数値欄と違う見た目なら補正
        const cs = getComputedStyle(lab);
        if (cs.position === 'absolute' && parseFloat(cs.fontSize) >= 15) return;
      }
      if (f.classList.contains('filter-range--seg') && f.querySelectorAll('input').length > 1) {
        f.querySelectorAll('input').forEach(i => i.parentElement && i.parentElement !== f && i.parentElement.classList.add('kfm-datefix'));
      } else f.classList.add('kfm-datefix');
      if (lab) lab.classList.add('kfm-fromto');
    });
  }
  const SKIP = /^(LABEL|SPAN|INPUT|SELECT|OPTION|IMG|SVG|PATH|B|I|A|BUTTON)$/i;
  function fitWidth() {
    const W = window.innerWidth + 2; let n = 0;
    const all = document.body.getElementsByTagName('*');
    for (let i = 0; i < all.length && n < 300; i++) {
      const el = all[i];
      if (SKIP.test(el.tagName) || el.id === 'kfm-badge' || el.closest('#kfm-list,#kfm-pager,#kfm-badge,#kfm-cols,.kfm-bottombar,.filter--checkbox,.panelCheck,.kfm-checkpair,.ag-row,.ui-autocomplete,.ui-menu,.ui-front,.content-column,.column-group')) continue;
      const r = el.getBoundingClientRect();
      if (r.right <= W || r.width < 120) continue;
      const p = el.parentElement;
      if (el.querySelector('.ui-front,.ui-autocomplete-input')) { el.style.setProperty('max-width', '100%', 'important'); n++; continue; }
      if (r.width > W && p && p !== document.body && !p.closest('#kfm-list') && !p.querySelector('.ui-front,.ui-autocomplete-input')) {          // 自体が画面より広い → 親で横スクロール
        p.style.setProperty('overflow-x', 'auto', 'important');
        p.style.setProperty('max-width', '100%', 'important');
      } else {                                                  // はみ出し位置のずれ → 縮めず折り返し
        el.style.setProperty('max-width', '100%', 'important');
        if (getComputedStyle(el).display.includes('flex')) el.style.setProperty('flex-wrap', 'wrap', 'important');
      }
      n++;
    }
  }

  // ---------- v0.1.9: 列を設定（モバイル用ボトムシート）----------
  let colsSuppress = false;   // 完了後、ネイティブが閉じるまでシートを開き直さない
  function colPanelWanted() {
    // Keepa は開くとき style.display="block"、閉じると "none"。CSSで常に画面外へ逃がすので computed は使わない
    const cc = document.querySelector('.content-column');
    if (!cc) return null;
    const d = (cc.style && cc.style.display) || '';
    if (d === 'none') return null;
    if (d === 'block') return cc;
    // 一部タブは class / 他手段。インラインが空でも offset と Keepa の表示意図を見る
    if (!d && cc.getAttribute('style') && /display\s*:\s*none/i.test(cc.getAttribute('style'))) return null;
    if (!d) {
      // デフォルト非表示のことが多い — 明示 block 以外は開いていない扱い
      return null;
    }
    return cc;
  }
  function forceCloseNativeCol(cc) {
    const panel = cc || document.querySelector('.content-column');
    if (panel) {
      try { panel.style.setProperty('display', 'none', 'important'); } catch (e) {}
      try { panel.style.display = 'none'; } catch (e) {}
    }
    // Keepa の内部状態を揃える（トグル）
    const t = document.querySelector('.tool__column .trigger');
    if (t && panel) {
      // すでに none ならクリックで開いてしまうので、一時的に block にしてからトグル、は危険。
      // 代わりに開いているときだけクリック: 呼び出し側で wanted だったものだけ
    }
  }
  function syncCloseNativeCol() {
    const panel = document.querySelector('.content-column');
    const t = document.querySelector('.tool__column .trigger');
    if (!panel || !t) return;
    // Keepa が block のままならトリガーで閉じる
    if (panel.style.display === 'block') {
      try { t.click(); } catch (e) {}
    }
    // それでも残っていたら強制
    if (panel.style.display === 'block' || !panel.style.display) {
      try { panel.style.display = 'none'; } catch (e) {}
    }
  }
  function readNativeColGroups(cc) {
    return [...cc.querySelectorAll('.column-group')].map(g => {
      const head = g.querySelector('p.toggle-children, p.font-medium') || g.querySelector('p');
      const headCb = head && head.querySelector('input[type=checkbox]');
      const name = norm((head && head.querySelector('label') ? head.querySelector('label').textContent : (head ? head.textContent : ''))).replace(/:$/, '').trim();
      const cols = [...g.querySelectorAll('input[type=checkbox][data-col-id]')].map(cb => {
        const lab = cc.querySelector('label[for="' + cssEsc(cb.id) + '"]') || cb.parentElement;
        const title = (lab && (lab.getAttribute('title') || lab.textContent)) || cb.getAttribute('data-col-id');
        return { cb, id: cb.getAttribute('data-col-id'), label: norm(title), on: !!cb.checked };
      });
      const onN = cols.filter(c => c.on).length;
      return { g, head, headCb, name: name || 'その他', cols, onN };
    }).filter(x => x.cols.length);
  }
  function openColSheet(cc) {
    if (document.getElementById('kfm-cols') || colsSuppress) return;
    kc(document.documentElement, 'kfm-cols-open', true);
    const groups = readNativeColGroups(cc);
    const sh = el('div'); sh.id = 'kfm-cols';
    const box = el('div', 'kfm-cols-sh'); sh.appendChild(box);
    const top = el('div', 'kfm-cols-top');
    top.appendChild(el('b', null, '表示する列'));
    const reset = el('button', null, 'リセット'); reset.type = 'button';
    const done = el('button', 'kfm-cols-done', '完了'); done.type = 'button';
    top.appendChild(reset); top.appendChild(done); box.appendChild(top);
    const tools = el('div', 'kfm-cols-tools');
    const q = el('input'); q.type = 'search'; q.placeholder = '列名で探す'; q.setAttribute('enterkeyhint', 'search');
    const only = el('label'); const onlyCb = el('input'); onlyCb.type = 'checkbox';
    only.appendChild(onlyCb); only.appendChild(document.createTextNode(' 表示中'));
    const showAll = el('button', null, '全表示'); showAll.type = 'button';
    const hideAll = el('button', null, '全隠し'); hideAll.type = 'button';
    [q, only, showAll, hideAll].forEach(x => tools.appendChild(x)); box.appendChild(tools);
    const body = el('div', 'kfm-cols-body'); box.appendChild(body);

    const state = { open: new Set(groups.map((g, i) => g.onN ? i : -1).filter(i => i >= 0)) };
    if (!state.open.size && groups.length) state.open.add(0);

    function flipNative(cb) {
      if (!cb) return;
      const lab = cc.querySelector('label[for="' + cssEsc(cb.id) + '"]');
      try { (lab || cb).click(); } catch (e) { try { cb.click(); } catch (e2) {} }
    }
    function paint() {
      const live = readNativeColGroups(cc);
      groups.length = 0; live.forEach(g => groups.push(g));
      const qq = norm(q.value).toLowerCase();
      const onlyOn = onlyCb.checked;
      body.textContent = '';
      let shown = 0;
      groups.forEach((g, gi) => {
        const cols = g.cols.filter(c => {
          c.on = !!c.cb.checked;
          if (onlyOn && !c.on) return false;
          if (qq && !(c.label.toLowerCase().includes(qq) || g.name.toLowerCase().includes(qq))) return false;
          return true;
        });
        g.onN = g.cols.filter(c => c.cb.checked).length;
        if (!cols.length && qq) return;
        if (onlyOn && !g.cols.some(c => c.cb.checked) && !cols.length) return;
        shown++;
        const wrap = el('div', 'kfm-cols-g' + (state.open.has(gi) ? '' : ' kfm-cols-collapsed'));
        const gh = el('button', 'kfm-cols-gh'); gh.type = 'button';
        const caret = el('span', 'kfm-cols-caret', state.open.has(gi) ? '▾' : '▸');
        gh.appendChild(caret);
        gh.appendChild(el('span', 'kfm-cols-gname', g.name));
        gh.appendChild(el('span', 'kfm-cols-gcount', g.onN + '/' + g.cols.length));
        const gall = el('button', 'kfm-cols-gall', g.onN === g.cols.length ? '全オフ' : '全オン'); gall.type = 'button';
        gall.addEventListener('click', e => {
          e.preventDefault(); e.stopPropagation();
          const wantOn = g.onN !== g.cols.length;
          g.cols.forEach(c => { if (!!c.cb.checked !== wantOn) flipNative(c.cb); });
          paint();
        });
        gh.appendChild(gall);
        gh.addEventListener('click', e => {
          if (e.target === gall || gall.contains(e.target)) return;
          if (state.open.has(gi)) state.open.delete(gi); else state.open.add(gi);
          paint();
        });
        wrap.appendChild(gh);
        cols.forEach(c => {
          const on = !!c.cb.checked;
          const row = el('div', 'kfm-cols-gi ' + (on ? 'kfm-cols-on' : 'kfm-cols-off'));
          const sw = el('button', 'kfm-cols-sw'); sw.type = 'button'; sw.setAttribute('aria-label', c.label); sw.setAttribute('aria-pressed', on ? 'true' : 'false');
          row.appendChild(sw);
          row.appendChild(el('span', 'kfm-cols-lab', c.label));
          const tog = ev => { ev.preventDefault(); ev.stopPropagation(); flipNative(c.cb); paint(); };
          row.addEventListener('click', tog);
          wrap.appendChild(row);
        });
        body.appendChild(wrap);
      });
      if (!shown) body.appendChild(el('div', 'kfm-cols-empty', '該当する列がありません'));
    }
    q.addEventListener('input', paint);
    onlyCb.addEventListener('change', paint);
    showAll.addEventListener('click', e => { e.preventDefault(); const b = cc.querySelector('.show-all'); if (b) b.click(); setTimeout(paint, 50); });
    hideAll.addEventListener('click', e => { e.preventDefault(); const b = cc.querySelector('.hide-all'); if (b) b.click(); setTimeout(paint, 50); });
    reset.addEventListener('click', e => { e.preventDefault(); const b = cc.querySelector('.reset-all'); if (b) b.click(); setTimeout(paint, 80); });
    const close = () => {
      colsSuppress = true;
      sh.remove();
      kc(document.documentElement, 'kfm-cols-open', false);
      syncCloseNativeCol();
      // Keepa が再度 block に戻しても、閉じるまで待つ
      let n = 0;
      const wait = setInterval(() => {
        n++;
        const panel = document.querySelector('.content-column');
        const open = panel && panel.style.display === 'block';
        if (open) syncCloseNativeCol();
        if (!open || n > 20) {
          clearInterval(wait);
          // ネイティブが完全に閉じたら抑制解除（次の「列を設定」で開ける）
          colsSuppress = false;
        }
      }, 100);
    };
    done.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); close(); });
    sh.addEventListener('click', e => { if (e.target === sh) close(); });
    document.body.appendChild(sh);
    paint();
  }
  function colSheetTick() {
    if (!mq.matches) {
      const s = document.getElementById('kfm-cols'); if (s) s.remove();
      kc(document.documentElement, 'kfm-cols-open', false);
      colsSuppress = false; return;
    }
    if (colsSuppress) return;
    const cc = colPanelWanted();
    if (cc) {
      kc(document.documentElement, 'kfm-cols-open', true); // フラッシュ防止（シート前でも）
      openColSheet(cc);
    } else {
      const s = document.getElementById('kfm-cols');
      if (s) { s.remove(); kc(document.documentElement, 'kfm-cols-open', false); }
    }
  }
  // 列を設定タップ直後にクラスを付けてフラッシュを防ぐ
  document.addEventListener('click', e => {
    if (!mq.matches) return;
    const tr = e.target.closest && e.target.closest('.tool__column .trigger, .tool__column');
    if (!tr) return;
    colsSuppress = false;
    kc(document.documentElement, 'kfm-cols-open', true);
    setTimeout(() => { try { colSheetTick(); } catch (err) {} }, 0);
  }, true);

  // ---------- v0.1.9: 複数選択オートコンプリート ----------
  function acWrap(inp) {
    return inp && (inp.closest('.filter-text--autocomplete') || (inp.closest('.filter-text') && inp.closest('.filter-text').querySelector('.filter-values')));
  }
  function acSelectedNames(wrap) {
    const vals = wrap && wrap.querySelector('.filter-values');
    if (!vals) return new Set();
    const set = new Set();
    vals.querySelectorAll(':scope > span').forEach(chip => {
      if (chip.classList.contains('clear-all')) return;
      const idEl = chip.querySelector('i[data-id]');
      if (!idEl || String(idEl.getAttribute('data-id')) === '-1') return;
      const lab = chip.querySelector('span');
      const name = norm(lab ? lab.textContent : chip.textContent.replace(/×/g, ''));
      if (name && name !== 'すべてクリア') set.add(acKey(name));
    });
    return set;
  }
  // v0.1.18: 候補とチップで「·」「･」「・」など表記が違う／候補の頭に「親カテゴリ »」が付くので、比べる前にそろえる
  const acKey = s => norm(String(s || '').normalize('NFKC').replace(/[\u00B7\u2027\u30FB\uFF65\u2022]/g, '・')).toLowerCase();
  function acItemName(li) {
    const raw = (li.querySelector('div') ? li.querySelector('div').textContent : li.textContent) || '';
    const t = norm(norm(raw).replace(/^\s*✓\s*/, '').split('»').pop());
    if (/^すべて選択/.test(t)) return { all: true, name: t };
    const m = t.match(/^(.*?)(?:\s*\(\d+\))?\s*$/);
    return { all: false, name: norm(m ? m[1] : t) };
  }
  function acMarkMenu(menu, wrap) {
    if (!menu) return;
    kc(menu, 'kfm-ac-multi', true);
    const sel = acSelectedNames(wrap);
    menu.querySelectorAll('li.ui-menu-item').forEach(li => {
      if (li.classList.contains('ui-item-select-all')) { kc(li, 'kfm-ac-on', false); return; }
      const info = acItemName(li);
      kc(li, 'kfm-ac-on', sel.has(acKey(info.name)));
    });
  }
  function acEnsureDone(inp) {
    let bar = document.getElementById('kfm-ac-done');
    if (!bar) {
      bar = el('div'); bar.id = 'kfm-ac-done';
      const b = el('button', null, '完了'); b.type = 'button';
      b.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        acClose(bar._inp || document.querySelector('.ui-autocomplete-input[aria-expanded="true"]'));
      });
      bar.appendChild(b); document.body.appendChild(bar);
    }
    kc(bar, 'kfm-ac-done-on', true);
    if (bar.style.display !== 'block') bar.style.display = 'block';
    bar._inp = inp;
    kc(document.documentElement, 'kfm-ac-open', true);
  }
  function acHideDone() {
    const bar = document.getElementById('kfm-ac-done');
    if (bar) { kc(bar, 'kfm-ac-done-on', false); if (bar.style.display !== 'none') bar.style.display = 'none'; bar._inp = null; }
    const was = document.documentElement.classList.contains('kfm-ac-open');
    kc(document.documentElement, 'kfm-ac-open', false);
    if (was) refitPagerCount();
  }
  function acClose(inp) {
    acHideDone();
    document.querySelectorAll('ul.ui-autocomplete').forEach(u => {
      try { u.style.display = 'none'; } catch (e) {}
      u.classList.remove('kfm-ac-multi');
    });
    if (inp) {
      try { inp.blur(); } catch (e) {}
      try { inp.setAttribute('aria-expanded', 'false'); } catch (e) {}
    }
  }
  function acReopen(inp) {
    if (!inp || !document.body.contains(inp)) return;
    try { inp.focus(); } catch (e) {}
    try {
      inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, which: 40, bubbles: true, cancelable: true }));
    } catch (e) {}
  }
  function acVisibleMenu() {
    return [...document.querySelectorAll('ul.ui-autocomplete')].find(u => {
      const st = getComputedStyle(u);
      return st.display !== 'none' && st.visibility !== 'hidden' && u.getClientRects().length && u.children.length;
    });
  }
  let acKeep = null, acQ = '', acScroll = 0;
  // v0.1.18: 文字で絞り込んでから選んでも、同じ検索語・同じ位置のまま候補を出し直す（連続選択）
  const acRemember = li => {
    const inp = (document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('ui-autocomplete-input'))
      ? document.activeElement : document.querySelector('.ui-autocomplete-input[aria-expanded="true"]');
    if (!inp || !acWrap(inp)) return;
    acKeep = inp; acQ = inp.value || ''; const m = li.closest('ul.ui-autocomplete'); acScroll = m ? m.scrollTop : 0;
  };
  document.addEventListener('touchstart', e => {
    if (!mq.matches) return;
    const li = e.target.closest && e.target.closest('ul.ui-autocomplete li.ui-menu-item');
    if (li) acRemember(li);
  }, { capture: true, passive: true });
  document.addEventListener('mousedown', e => {
    if (!mq.matches) return;
    const li = e.target.closest && e.target.closest('ul.ui-autocomplete li.ui-menu-item');
    if (!li) {
      const bar = document.getElementById('kfm-ac-done');
      if (bar && bar.classList.contains('kfm-ac-done-on')) {
        if (e.target.closest && (e.target.closest('#kfm-ac-done') || e.target.closest('ul.ui-autocomplete') || e.target.closest('.filter-text--autocomplete') || (e.target.classList && e.target.classList.contains('ui-autocomplete-input')))) return;
        acClose(bar._inp);
      }
      return;
    }
    const inp = (document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('ui-autocomplete-input'))
      ? document.activeElement
      : (document.querySelector('.ui-autocomplete-input[aria-expanded="true"]') || null);
    if (!acWrap(inp)) return;
    if (acKeep !== inp || !acQ) acRemember(li);
  }, true);
  document.addEventListener('click', e => {
    if (!mq.matches) return;
    const li = e.target.closest && e.target.closest('ul.ui-autocomplete li.ui-menu-item');
    if (!li) return;
    const inp = acKeep || (document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('ui-autocomplete-input') ? document.activeElement : null);
    const wrap = acWrap(inp);
    if (!wrap || !inp) return;
    const q = acQ, sc = acScroll;
    setTimeout(() => {
      if (q && inp.value !== q) { try { inp.value = q; } catch (er) {} }
      acReopen(inp);
      let n = 0;
      (function fin() {
        const menu = acVisibleMenu();
        if (menu) { acMarkMenu(menu, wrap); acEnsureDone(inp); if (sc) menu.scrollTop = sc; acQ = ''; return; }
        if (++n < 8) { setTimeout(fin, 80); return; }   // 絞り込み検索は結果が遅れて来る
        acQ = ''; acHideDone();
      })();
    }, 30);
  }, true);
  // フォーカス外れ・メニュー消滅ですぐ完了バーを消す
  document.addEventListener('focusout', e => {
    if (!mq.matches) return;
    setTimeout(() => {
      if (!acVisibleMenu()) acHideDone();
    }, 120);
  }, true);
  function acTick() {
    if (!mq.matches) { acHideDone(); return; }
    const menu = acVisibleMenu();
    if (!menu) { acHideDone(); return; }
    const inp = (document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('ui-autocomplete-input'))
      ? document.activeElement
      : document.querySelector('.ui-autocomplete-input[aria-expanded="true"]');
    const wrap = acWrap(inp);
    if (!wrap) { kc(menu, 'kfm-ac-multi', false); acHideDone(); return; }
    acMarkMenu(menu, wrap);
    acEnsureDone(inp);
  }
  // メニュー出現を即座に検知（初回から ✓ とスタイル）
  let acMoT = 0;
  (function armAcMo() {
    const root = document.documentElement;
    if (!root) { setTimeout(armAcMo, 0); return; }
    new MutationObserver(() => {
      if (!mq.matches) return;
      clearTimeout(acMoT);
      acMoT = setTimeout(() => { try { acTick(); } catch (e) {} }, 40);
    }).observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'aria-expanded'] });
  })();


  // ---- v0.1.17: キーボード対応 ----
  // iOS Safari はキーボードが出ても画面下固定の要素を動かさない（キーボードの裏に隠れる・入力欄に重なる）。
  // 見えている範囲（visualViewport）を測って、下のバー・シート・候補リストをキーボードの上に合わせる
  (function kbWatch() {
    const vv = window.visualViewport;
    if (!vv) return;
    let raf = 0, last = '';
    const H = () => document.documentElement;
    const field = () => { const a = document.activeElement; return a && a !== document.body && (/^(INPUT|TEXTAREA)$/.test(a.tagName) && !/^(checkbox|radio|button|submit|range|color|file)$/i.test(a.type || '') || a.isContentEditable) ? a : null; };
    function apply() {
      raf = 0;
      const h = H(); if (!h) return;
      const f = field();
      const kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      const on = !!f && mq.matches && vv.scale < 1.05 && kb > 120;
      const was = h.classList.contains('kfm-kb');
      kc(h, 'kfm-kb', on);
      if (on && !was) liftSoon();
      document.querySelectorAll('.kfm-kb-host').forEach(b => { if (!on || !b.contains(f)) b.classList.remove('kfm-kb-host'); });
      if (!on) { if (last) { ['--kfm-kb', '--kfm-vvtop', '--kfm-vvh', '--kfm-acmax'].forEach(k => h.style.removeProperty(k)); last = ''; } return; }
      const bb = f.closest('.kfm-bottombar'); if (bb) kc(bb, 'kfm-kb-host', true);
      // 候補リストは入力欄の下〜キーボード（と完了ボタン）の上に収める
      const r = f.getBoundingClientRect();
      const visBottom = vv.offsetTop + vv.height;
      const acmax = Math.max(120, Math.round(visBottom - 64 - 8 - Math.max(r.bottom, vv.offsetTop)));
      const key = [kb, Math.round(vv.offsetTop), Math.round(vv.height), acmax].join('|');
      if (key === last) return;
      last = key;
      h.style.setProperty('--kfm-kb', kb + 'px');
      h.style.setProperty('--kfm-vvtop', Math.round(vv.offsetTop) + 'px');
      h.style.setProperty('--kfm-vvh', Math.round(vv.height) + 'px');
      h.style.setProperty('--kfm-acmax', acmax + 'px');
    }
    const soon = () => { if (!raf) raf = requestAnimationFrame(apply); };
    vv.addEventListener('resize', soon, { passive: true });
    vv.addEventListener('scroll', () => { if (H() && H().classList.contains('kfm-kb')) soon(); }, { passive: true });
    document.addEventListener('focusin', () => { soon(); setTimeout(soon, 350); setTimeout(soon, 700); }, true);
    document.addEventListener('focusout', () => setTimeout(soon, 50), true);
    // 候補リストが入力欄の上に重ならないよう、狭いときは入力欄を見える範囲の上の方へ寄せる（キーボードが出きってから）
    function liftInput(t) {
      if (!t || !t.classList || !t.classList.contains('ui-autocomplete-input') || t.closest('.kfm-bottombar,#kfm-cols,#kfm-sheet,#kfm-tm,#kfm-tm-sheet')) return;
      if (document.activeElement !== t || !H().classList.contains('kfm-kb')) return;
      const r = t.getBoundingClientRect(), room = vv.offsetTop + vv.height - 72 - r.bottom;
      if (room >= 200) return;
      let hb = 0;   // 上の固定ヘッダー（Keepa のロゴ・タブ）の下に入力欄が来るように
      for (let y = vv.offsetTop + 2; y < vv.offsetTop + 220; y += 6) {
        let e = document.elementFromPoint(12, y), fixed = false;
        while (e && e !== document.body) { const p = getComputedStyle(e).position; if (p === 'fixed' || p === 'sticky') { fixed = true; break; } e = e.parentElement; }
        if (!fixed || (e && (e.contains(t) || e.matches('.ui-autocomplete,#kfm-ac-done')))) break; hb = y - vv.offsetTop;
      }
      window.scrollBy(0, Math.round(r.top - vv.offsetTop - hb - 12));
      soon();
    }
    let liftT = 0;
    const liftSoon = () => { clearTimeout(liftT); liftT = setTimeout(() => liftInput(document.activeElement), 250); };
    document.addEventListener('focusin', () => { if (H().classList.contains('kfm-kb')) liftSoon(); }, true);
  })();
  // ---------- loop ----------
  let timer = 0, busy = false;
  const isTyping = () => {
    const a = document.activeElement;
    return !!a && a !== document.body && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable);
  };
  // 数値の範囲欄だけ inputmode=decimal（type は変えない・オートコンプリートは触らない）
  function wantsDecimal(i) {
    if (!i || i.tagName !== 'INPUT') return false;
    const t = (i.getAttribute('type') || 'text').toLowerCase();
    if (t !== 'text') return false;
    if (i.classList.contains('ui-autocomplete-input') || i.classList.contains('hasDatepicker')) return false;
    if (i.closest('.filter-text,.ui-front,.filter-text--autocomplete')) return false;
    const f = i.closest('.filter-range--field');
    if (f && /-date/.test(f.className)) return false;
    return i.classList.contains('filter-range--input') || !!i.closest('.filter-range--seg,.filter-range');
  }
  function setDecimal(i) {
    if (wantsDecimal(i) && i.getAttribute('inputmode') !== 'decimal') i.setAttribute('inputmode', 'decimal');
  }
  function numericKeyboards() {
    document.querySelectorAll('.filter-range input').forEach(setDecimal);
  }
  let feT = 0;
  ['input', 'change'].forEach(ev => document.addEventListener(ev, () => {
    if (!mq.matches || !onFinder()) return; clearTimeout(feT); feT = setTimeout(() => { try { filterEdit(); } catch (e) {} }, 300);
  }, true));
  ['touchstart', 'focusin', 'input'].forEach(ev =>
    document.addEventListener(ev, e => { if (mq.matches) setDecimal(e.target && e.target.closest ? e.target.closest('input') : null); }, { capture: true, passive: true }));
  function verBadge() {
    if (document.getElementById('kfm-ver') || !document.body) return;
    const v = document.createElement('div'); v.id = 'kfm-ver'; v.textContent = VERSION;
    document.body.appendChild(v);
  }
  // ---- v0.0.21: ページ全体の横はみ出し検出・修正 ----
  let ovfList = [];
  const selOf = e => { let t = e.tagName.toLowerCase(); if (e.id) t += '#' + e.id; const c = [...e.classList].filter(x => !/^kfm-ovfx$/.test(x)).slice(0, 3); if (c.length) t += '.' + c.join('.'); return t; };
  function fixOverflow() {
    if (!onFinder()) return;
    const H = document.documentElement, W = window.innerWidth;
    const scan = () => {
      const out = [];
      const all = document.body.getElementsByTagName('*');
      for (let i = 0; i < all.length; i++) {
        const e = all[i];
        const r = e.getBoundingClientRect();
        if ((r.width === 0 && r.height === 0) || (r.right <= W + 1 && r.left >= -1)) continue;
        if (e.closest('.kfm-gridhost,#kfm-ovf,#kfm-cols,.ui-autocomplete,.ui-menu,#kfm-pager,.kfm-swacts,.kfm-inner,.kfm-swopen,.content-column,.column-group')) continue;   // 隠しグリッドは1pxの箱のまま触らない
        if (r.right > W + 1 || r.left < -1) out.push({ e, w: Math.round(r.width), l: Math.round(r.left), r: Math.round(r.right) });
      }
      out.sort((a, b) => b.w - a.w); return out;
    };
    let off = H.scrollWidth > W + 1 ? scan() : [];
    ovfList = off.slice(0, 15).map(o => `${selOf(o.e)}  w=${o.w} l=${o.l} r=${o.r}`);
    let n = 0;
    for (const o of off) {                      // 自分自身が画面より広い要素（外側から）だけ縮める
      if (n > 200) break;
      const e = o.e, tag = e.tagName;
      if (/^(IMG|SVG|PATH|INPUT|SELECT|OPTION|TEXTAREA)$/.test(tag)) { e.style.setProperty('max-width', '100%', 'important'); continue; }
      if (o.w > W + 1) {
        e.style.setProperty('max-width', '100%', 'important'); e.style.setProperty('min-width', '0', 'important');
        e.style.setProperty('box-sizing', 'border-box', 'important');
        const st = getComputedStyle(e);
        if (/px/.test(e.style.width) || parseFloat(st.width) > W) e.style.setProperty('width', 'auto', 'important');
        if (st.display.includes('flex')) e.style.setProperty('flex-wrap', 'wrap', 'important');
        if (st.display === 'table' || tag === 'TABLE' || tag === 'PRE') { e.style.setProperty('display', 'block', 'important'); e.style.setProperty('overflow-x', 'auto', 'important'); }
        n++;
      } else if (o.l < -1 || (e.style.marginLeft && parseFloat(e.style.marginLeft) < 0)) { e.style.setProperty('margin-left', '0', 'important'); n++; }
    }
    if (!scrollBusy()) { if (window.scrollX > 1) window.scrollTo(0, window.scrollY);
      if (H.scrollLeft) H.scrollLeft = 0; if (document.body.scrollLeft) document.body.scrollLeft = 0; }
    const still = H.scrollWidth > W + 1;
    const v = document.querySelector('#kfm-pager .kfm-pg-ver'); if (v) v.classList.toggle('kfm-ovf', still || ovfList.length > 0);
    if ((DEBUG || still) && ovfList.length) console.log('[kfm] overflow scrollWidth=' + H.scrollWidth + ' innerWidth=' + W + (still ? ' (still)' : ' (fixed)') + '\n' + ovfList.join('\n'));
  }
  function showOverflowReport() {
    const old = document.getElementById('kfm-ovf'); if (old) { old.remove(); return; }
    fixOverflow();
    const H = document.documentElement;
    const txt = `Keepa mobile ${VERSION}\nscrollWidth=${H.scrollWidth} innerWidth=${innerWidth} screen=${screen.width}\nviewport=${(document.querySelector('meta[name=viewport]') || {}).content || '-'}\n` +
      (ovfList.length ? 'はみ出し要素（広い順）:\n' + ovfList.join('\n') : 'はみ出し要素なし');
    const b = document.createElement('div'); b.id = 'kfm-ovf'; b.textContent = txt;
    const cp = document.createElement('button'); cp.type = 'button'; cp.textContent = 'コピー';
    cp.addEventListener('click', () => { try { navigator.clipboard.writeText(txt).then(() => toast('コピーしました', true)); } catch (e) {} });
    const cl = document.createElement('button'); cl.type = 'button'; cl.textContent = '閉じる';
    cl.addEventListener('click', () => b.remove());
    b.appendChild(document.createElement('br')); b.appendChild(cp); b.appendChild(cl); document.body.appendChild(b);
  }
  document.addEventListener('click', e => { const v = e.target.closest && e.target.closest('#kfm-pager .kfm-pg-ver'); if (v) { e.preventDefault(); e.stopPropagation(); showOverflowReport(); } }, true);
  window.addEventListener('hashchange', () => [300, 1000, 2500].forEach(t => setTimeout(() => { setViewport(); fixOverflow(); }, t)));

  // ---- v0.0.21 トラッキング：タブを自動で開く＋スマホ用フォーム（値は変えない・保存は押さない）----
  let trackReqTimer = 0;
  function trackAutoOpen() {
    if (trackReqTimer || !onProduct()) return;
    let req = null; try { req = JSON.parse(localStorage.getItem('kfmTrackReq') || 'null'); } catch (e) {}
    if (!req || !req.asin || Date.now() - req.t > 60000) return;
    if (location.hash.toUpperCase().indexOf('-' + String(req.asin).toUpperCase()) < 0) return;
    const t0 = Date.now();
    trackReqTimer = setInterval(() => {
      const tab = document.querySelector('li#tabTrack');
      if (tab && tab.offsetParent !== null) { clearInterval(trackReqTimer); trackReqTimer = 0; try { localStorage.removeItem('kfmTrackReq'); } catch (e) {} tab.click(); schedule(); }
      else if (Date.now() - t0 > 15000 || !onProduct()) { clearInterval(trackReqTimer); trackReqTimer = 0; try { localStorage.removeItem('kfmTrackReq'); } catch (e) {} }
    }, 300);
  }
  function trackVisible() {
    const f = document.getElementById('trackingForm'), tr = document.getElementById('track');
    if (!f || !tr || !onProduct()) return false;
    const st = getComputedStyle(tr);
    if (st.display === 'none' || st.visibility === 'hidden') return false;
    for (let a = tr.parentElement; a && a !== document.body; a = a.parentElement) { const s2 = getComputedStyle(a); if (s2.display === 'none' || s2.visibility === 'hidden') return false; }
    return f.getClientRects().length > 0;
  }
  function trackDecorate() {
    const tr = document.getElementById('track'); if (!tr) return;
    tr.querySelectorAll('input[id^="csvtype-"][id$="-threshold"]').forEach(i => { if (i.getAttribute('inputmode') !== 'numeric') { i.setAttribute('inputmode', 'numeric'); i.setAttribute('pattern', '[0-9]*'); } });
    tr.querySelectorAll('.tracking__block[data-type]').forEach(b => {
      const cur = b.querySelector('.tracking__suggestion-item--current td:last-child');
      const tf = b.querySelector('.mdc-text-field');
      let h = b.querySelector(':scope > .kfm-cur');
      if (cur && tf) {
        if (!h) { h = document.createElement('div'); h.className = 'kfm-cur'; tf.after(h); }
        const txt = '現在の価格: ' + norm(cur.textContent);
        if (h.textContent !== txt) { h.textContent = ''; h.appendChild(document.createTextNode('現在の価格: ')); const bb = document.createElement('b'); bb.textContent = norm(cur.textContent); h.appendChild(bb); }
      }
    });
    const radios = ['tracking-mode-basic-radio', 'tracking-mode-advanced-radio', 'tracking-mode-pro-radio'].map(id => document.getElementById(id)).filter(Boolean);
    if (radios.length > 1) {
      const items = radios.map(r => r.closest('.mdc-form-field') || r.parentElement);
      let par = items[0].parentElement;
      if (items.every(it => it.parentElement === par)) {
        par.classList.add('kfm-seg');
        items.forEach((it, k) => { it.classList.add('kfm-seg-item', k === 0 ? 'kfm-first' : k === items.length - 1 ? 'kfm-last' : 'kfm-mid'); it.classList.toggle('kfm-on', radios[k].checked);
          if (!it.dataset.kfmSeg) { it.dataset.kfmSeg = '1'; radios[k].addEventListener('change', () => setTimeout(trackDecorate, 0)); } });
      }
    }
    let bar = document.getElementById('kfm-trackbar');
    if (!bar) {
      bar = document.createElement('div'); bar.id = 'kfm-trackbar';
      const back = document.createElement('button'); back.type = 'button'; back.className = 'kfm-tb-back'; back.textContent = 'グラフに戻る';
      back.addEventListener('click', () => { const g = document.getElementById('tabGraph'); if (g) g.click(); setTimeout(trackTick, 200); setTimeout(trackTick, 800); });
      const save = document.createElement('button'); save.type = 'button'; save.className = 'kfm-tb-save'; save.textContent = 'トラッキング開始';
      save.addEventListener('click', e => { e.preventDefault(); const real = document.getElementById('submitTracking'); if (real && !real.disabled) real.click(); });   // ユーザーのタップでKeepa本物のボタンを押す（自動送信はしない）
      bar.appendChild(back); bar.appendChild(save); document.body.appendChild(bar);
    }
    const real = document.getElementById('submitTracking'), sv2 = bar.querySelector('.kfm-tb-save');
    if (sv2) sv2.disabled = !real || real.disabled || real.getAttribute('aria-disabled') === 'true';
  }
  // v0.1.2: トラッキング画面を開いた直後にスクロールできない問題の対策
  const ownSheetOpen = () => !!(document.getElementById('kfm-tm') || document.getElementById('kfm-tm-sheet') ||
    (onFinder() && (document.getElementById('kfm-sheet') || document.getElementById('kfm-ask'))));
  function trackUnlock() {   // 自分の画面が開いていなければ、html/body に付いたスクロール止めを即座に外す
    if (!trackOn || ownSheetOpen()) return;
    const H = document.documentElement;
    if (!onFinder()) ['kfm-sheet', 'kfm-ask'].forEach(i => { const e = document.getElementById(i); if (e) e.remove(); });   // 製品ファインダーから持ち越した画面
    kc(H, 'kfm-tm-on', false);
    [H, document.body].forEach(e => { if (!e) return; ['overflow', 'overflow-y', 'position', 'touch-action', 'height', 'top'].forEach(pr => { if (e.style.getPropertyValue(pr)) e.style.removeProperty(pr); }); });
  }
  let trkNudgeAt = 0;
  function trackNudge() {   // iOS: 中身が後から増えた固定スクロール枠は、配置し直すまでスクロールしないことがある
    const tr = document.getElementById('track');
    if (!trackOn || !tr || kfmTouching || tr.classList.contains('kfm-trk-nudge')) return;
    trkNudgeAt = Date.now();
    const y = tr.scrollTop;
    tr.classList.add('kfm-trk-nudge'); void tr.offsetHeight;
    requestAnimationFrame(() => { tr.classList.remove('kfm-trk-nudge'); void tr.offsetHeight; if (!kfmTouching && Math.abs(tr.scrollTop - y) > 1) tr.scrollTop = y; });
  }
  let trkRO = null, trkMO = null, trkH = 0, trkNudgeT = 0;
  function trackWatch() {
    const tr = document.getElementById('track'); if (!tr) return;
    if (!trkMO) {
      trkMO = new MutationObserver(() => { if (trackOn) trackUnlock(); });
      trkMO.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] });
      if (document.body) trkMO.observe(document.body, { attributes: true, attributeFilter: ['style', 'class'] });
    }
    if (window.ResizeObserver && (!trkRO || trkRO._el !== tr)) {
      if (trkRO) trkRO.disconnect();
      trkRO = new ResizeObserver(() => {
        if (!trackOn || Math.abs(tr.scrollHeight - trkH) < 2) return;
        trkH = tr.scrollHeight; clearTimeout(trkNudgeT);
        trkNudgeT = setTimeout(function n2() { if (kfmTouching) { trkNudgeT = setTimeout(n2, 300); return; } if (Date.now() - trkNudgeAt > 150) trackNudge(); }, 150);
      });
      trkRO._el = tr; trkRO.observe(tr); [...tr.children].forEach(c => trkRO.observe(c));
    }
  }
  function trackTick() {
    const on = isMobile() && trackVisible();
    if (on) trackDecorate();
    if (on !== trackOn) {
      trackOn = on; kc(document.documentElement, 'kfm-track', on);
      setViewport();
      if (on) { trackUnlock(); trackWatch(); [0, 120, 400, 1000, 2000].forEach(t => setTimeout(trackNudge, t)); }
      if (!on) { [300, 1200].forEach(t => setTimeout(measureProduct, t)); }
    }
  }
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('#tabGraph,#tabTrack,li.tabItem')) [100, 400, 1000].forEach(t => setTimeout(trackTick, t)); }, true);
  window.addEventListener('hashchange', () => setTimeout(trackTick, 100));
  setInterval(() => { if (trackOn || (onProduct() && document.getElementById('trackingForm'))) trackTick(); }, 1000);
  // ===== v0.0.22: トラッキング整理（#!manage でチェックして削除）=====
  // Keepa 本物の各行「削除」ボタンを、ユーザーが実行を押したときだけ1件ずつ押す。一括メニュー(#fab-tasks)は使わない。
  const onManage = () => /^#!manage/i.test(location.hash);
  const ICON_BROOM = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/><path d="M3 3l18 18"/></svg>';
  const ICON_X = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const ICON_RELOAD = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>';
  const ICON_TRASH_W = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>';
  const ICON_GRID = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/></svg>';
  const ICON_PHONE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></svg>';
  const ICON_MONITOR = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>';
  const ICON_GEAR = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>';
  const tm = { items: [], sel: new Set(), q: '', dry: false, running: false, stop: false, orig: false, total: 0, src: {}, scUsed: '' };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  function tmRoot() { return [...document.querySelectorAll('.ag-root-wrapper')].find(w => !w.closest('.ag-details-row')) || null; }
  function tmViewport(root) { return root && [...root.querySelectorAll('.ag-root-wrapper-body > .ag-root > .ag-body-viewport')].find(v => !v.closest('.ag-details-row')) || null; }
  const outer = (root, sel) => [...root.querySelectorAll(sel)].filter(e => !e.parentElement.closest('.ag-details-row'));
  function tmTotal() {
    const m = norm(document.body.innerText || '').match(/([\d,]+)\s*追跡中/);
    return m ? parseInt(m[1].replace(/,/g, ''), 10) : 0;
  }
  // v0.0.33: 1商品 = 外側グリッドの row-index が同じ「マスター行」の各パーツ（左固定・中央・右固定）＋あれば詳細行
  const TM_PARTS = ['ag-pinned-left-cols-container', 'ag-center-cols-container', 'ag-pinned-right-cols-container'];
  const TM_ASIN_RE = /\b(B0[A-Z0-9]{8})\b/;
  function tmParts(root, idx) { return TM_PARTS.flatMap(p => outer(root, `.${p} > .ag-row[row-index="${idx}"]`)); }
  function tmItems(root) {   // [{idx, parts:[], detail}]
    const map = new Map();
    outer(root, TM_PARTS.map(p => `.${p} > .ag-row`).join(',')).forEach(r => {
      if ((r.getAttribute('row-id') || '').startsWith('detail_') || r.classList.contains('ag-full-width-row')) return;
      const i = r.getAttribute('row-index'); if (i == null) return;
      if (!map.has(i)) map.set(i, { idx: +i, parts: [], detail: null }); map.get(i).parts.push(r);
    });
    outer(root, '.ag-full-width-container > .ag-row').forEach(d => { const m = map.get(String(+d.getAttribute('row-index') - 1)); if (m) m.detail = d; });
    return [...map.values()].sort((a, b) => a.idx - b.idx);
  }
  function tmAsinOf(it) {   // 返り値 [asin, 取得元]
    const els = [...it.parts, it.detail].filter(Boolean);
    for (const e of els) { const g = e.querySelector('.graph[data-asin]'); if (g && g.getAttribute('data-asin')) return [g.getAttribute('data-asin').toUpperCase(), 'graph']; }
    for (const e of els) for (const a of e.querySelectorAll('a[href]')) {
      const h = a.getAttribute('href') || '';
      let m = h.match(/#!product\/\d+-([A-Z0-9]{10})/i); if (m) return [m[1].toUpperCase(), 'productリンク'];
      m = h.match(/[?&]asin=([A-Z0-9]{10})/i) || h.match(/\/dp\/([A-Z0-9]{10})/i); if (m) return [m[1].toUpperCase(), 'amazonリンク'];
    }
    for (const e of els) for (const x of e.querySelectorAll('[data-asin],[asin]')) { const v = x.getAttribute('data-asin') || x.getAttribute('asin'); if (/^[A-Z0-9]{10}$/i.test(v || '')) return [v.toUpperCase(), 'data属性']; }
    for (const e of els) { const m = norm(e.textContent).match(TM_ASIN_RE); if (m) return [m[1], "テキスト"]; }
    return ['', ''];
  }
  function tmRead(root, it) {
    const [asin, src] = tmAsinOf(it); if (!asin) return null;
    const els = [...it.parts, it.detail].filter(Boolean);
    // v0.0.33: 商品名は「表示されている文字」から取る（Amazonアイコン・国旗のツールチップ(title属性)は使わない）
    const BAD = /Amazon\s*で開く|トラッキングドメイン|履歴グラフ|トラッキングを削除|削除をキャンセル/;
    const txt = e => norm(e.textContent);
    const okT = t => t.length > 6 && !BAD.test(t) && !/^[¥￥\d,.\s%⁃-]+$/.test(t) && !TM_ASIN_RE.test(t.trim()) ;
    let title = '';
    for (const e of els) { const c = [...e.querySelectorAll('[col-id]')].find(x => /title|name|商品/i.test(x.getAttribute('col-id'))); if (c && okT(txt(c))) { title = txt(c); break; } }
    if (!title) { let best = ''; els.forEach(e => e.querySelectorAll('a[href]').forEach(x => { const t = txt(x); if (okT(t) && t.length > best.length) best = t; })); title = best; }
    if (!title) { let best = ''; els.forEach(e => e.querySelectorAll('[col-id]').forEach(x => { const id = x.getAttribute('col-id'); if (/_(current|desired|delta|backInStock|outOfStock)$|metaData|imagesCSV|graphData/.test(id)) return; const t = txt(x); if (okT(t) && t.length > best.length) best = t; })); title = best; }
    if (!title && it.detail) { const a = it.detail.querySelector('a.href[href*="#!product/"]'); if (a) title = a.getAttribute('title') || txt(a); }
    let img = '';
    for (const e of els) { const im = [...e.querySelectorAll('img[src^="http"]')].find(x => /media-amazon|images-amazon|ssl-images/.test(x.src)); if (im) { img = im.src; break; } }
    const cv = id => { for (const e of els) { const c = e.querySelector(`[col-id="${id}"]`); if (c) { const t = norm(c.textContent).replace(/\s+/g, ''); return t && t !== '-' ? t : ''; } } return ''; };
    const prices = [];
    [['BUY_BOX_SHIPPING', 'Buy Box'], ['AMAZON', 'Amazon'], ['NEW', '新品']].forEach(([id, lb]) => { const goal = cv(id + '_desired'), now = cv(id + '_current'); if (goal || now) prices.push({ lb, goal, now }); });
    return { asin, src, title: title || asin, img: img || thumbFor(asin), prices };
  }
  const tmFrame = () => new Promise(r => { const t = setTimeout(r, 120); requestAnimationFrame(() => requestAnimationFrame(() => { clearTimeout(t); r(); })); });
  function tmCand(root, vp) {
    const out2 = [];
    const add = e => { if (e && !out2.includes(e)) out2.push(e); };
    outer(root, '.ag-body-vertical-scroll-viewport').forEach(add); add(vp);
    outer(root, '.ag-center-cols-viewport, .ag-body-viewport').forEach(add); add(root); add(document.scrollingElement);
    for (let a = root.parentElement; a && a !== document.body; a = a.parentElement) add(a);
    return out2;
  }
  function tmScrollerOk(e) {   // 実際に scrollTop が動くものだけ
    if (!e || e.scrollHeight <= e.clientHeight + 4) return false;
    const b = e.scrollTop; e.scrollTop = b + 5; const ok = e.scrollTop !== b; e.scrollTop = b; return ok;
  }
  function tmPushScroll(e, y) { e.scrollTop = y; e.dispatchEvent(new Event('scroll', { bubbles: false })); }
  function tmDbg() {
    const root = tmRoot(), vp = root && tmViewport(root);
    const r = root ? root.getBoundingClientRect() : null;
    const items = root ? tmItems(root) : [];
    const one = items[0] ? tmAsinOf(items[0]) : ['', ''];
    const sc = root ? tmCand(root, vp).slice(0, 7).map(e => `${e === document.scrollingElement ? 'page' : selOf(e)} ${Math.round(e.scrollTop)}/${e.scrollHeight}(${e.clientHeight})${tmScrollerOk(e) ? ' ✓動く' : ''}`) : [];
    const cols = items[0] ? [...new Set(items[0].parts.flatMap(p => [...p.querySelectorAll('[col-id]')].map(c => c.getAttribute('col-id'))))].slice(0, 14).join(',') : '';
    return [`${VERSION} 追跡中表示:${tmTotal()} 読めた:${tm.items.length}`, `一覧:${root ? 'あり ' + Math.round(r.width) + 'x' + Math.round(r.height) : 'なし'} viewport:${vp ? 'あり' : 'なし'}`,
      `行: 商品${items.length} / 詳細${items.filter(i => i.detail).length} / graph${root ? root.querySelectorAll('.graph[data-asin]').length : 0}`,
      `ASIN取得元: ${Object.entries(tm.src).map(([k, v]) => k + '×' + v).join(' ') || 'なし'} / 1行目:${one[0] || 'なし'}(${one[1] || '-'})`,
      `列: ${cols}`, `使ったスクロール: ${tm.scUsed || '-'}`, `最後の削除: ${tm.lastDiag || '-'}`, ...(tm.diags || []).map(x => '・' + x), ...sc, tm.dbgNote || ''].join('\n');
  }
  async function tmCollect(onProg) {
    const root = tmRoot(); if (!root) throw new Error('Keepaの一覧が見つかりません');
    kc(root, 'kfm-tm-grid', true);   // 見えないが実寸で描画させる（display:none にしない）
    await tmFrame(); await sleep(300);
    const vp = tmViewport(root); const map = new Map(); tm.src = {};
    const total = tmTotal(); let lastNew = Date.now(), guard = 0, atEnd = 0;
    let scrollers = tmCand(root, vp).filter(tmScrollerOk);
    tm.scUsed = scrollers.map(e => e === document.scrollingElement ? 'page' : selOf(e)).join(' + ') || 'なし';
    scrollers.forEach(s2 => tmPushScroll(s2, 0)); await sleep(500);
    const harvest = () => { let n = 0; tmItems(root).forEach(d => { const it = tmRead(root, d); if (it && !map.has(it.asin)) { map.set(it.asin, it); tm.src[it.src] = (tm.src[it.src] || 0) + 1; n++; } }); return n; };
    tm.dbgNote = '';
    while (guard++ < 3000) {
      if (harvest()) lastNew = Date.now();
      onProg(map, total);
      if (total && map.size >= total) break;
      if (Date.now() - lastNew > 8000) { tm.dbgNote = `8秒間 新しい行なし→中断 (位置 ${scrollers.map(e => Math.round(e.scrollTop) + '/' + e.scrollHeight).join(',')})`; break; }
      if (!scrollers.length) { scrollers = tmCand(root, vp).filter(tmScrollerOk); if (!scrollers.length) { await sleep(500); continue; } }
      let moved = false;
      scrollers.forEach(s2 => { const b = s2.scrollTop; tmPushScroll(s2, b + Math.max(120, (s2.clientHeight || 600) * 0.8)); if (s2.scrollTop !== b) moved = true; });
      atEnd = moved ? 0 : atEnd + 1;
      await tmFrame(); await sleep(350);
      if (atEnd > 6 && Date.now() - lastNew > 3000) { harvest(); onProg(map, total); tm.dbgNote = `一番下まで到達 (位置 ${scrollers.map(e => Math.round(e.scrollTop) + '/' + e.scrollHeight).join(',')})`; break; }
    }
    scrollers.forEach(s2 => tmPushScroll(s2, 0));
    return { list: [...map.values()], total };
  }
  function tmSetSearch(v) {
    let inp = document.getElementById('fab-search-input');
    if (!inp || !inp.getClientRects().length) { const b = document.getElementById('fab-search'); if (b) b.click(); inp = document.getElementById('fab-search-input'); }
    if (!inp) return false;
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(inp, v);
    ['input', 'keyup', 'change'].forEach(t => inp.dispatchEvent(new Event(t, { bubbles: true })));
    return true;
  }
  const vis = e => !!e && e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none';
  async function tmWaitOne(root, asin, ms) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const its = tmItems(root);
      if (its.length === 1 && tmAsinOf(its[0])[0] === asin) return its[0];
      await sleep(250);
    }
    return null;
  }
  function tmFire(t) {   // v0.0.33: 実際のタップに近いイベント列を送る
    const r = t.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    const o = { bubbles: true, cancelable: true, composed: true, view: window, clientX: x, clientY: y, button: 0, buttons: 1 };
    const P = window.PointerEvent || MouseEvent;
    try { t.dispatchEvent(new P('pointerdown', Object.assign({ pointerId: 1, pointerType: 'mouse', isPrimary: true }, o))); } catch (e) {}
    t.dispatchEvent(new MouseEvent('mousedown', o));
    try { t.dispatchEvent(new P('pointerup', Object.assign({ pointerId: 1, pointerType: 'mouse', isPrimary: true }, o, { buttons: 0 }))); } catch (e) {}
    t.dispatchEvent(new MouseEvent('mouseup', Object.assign({}, o, { buttons: 0 })));
    t.dispatchEvent(new MouseEvent('click', Object.assign({}, o, { buttons: 0 })));
  }
  async function tmSawCancel(del, cancel, ms) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (cancel && vis(cancel)) return 'cancel表示';
      if (!del.isConnected) return '行が消えた';
      if (!vis(del)) return '削除ボタンが隠れた';
      await sleep(100);
    }
    return '';
  }
  async function tmGone(root, asin, ms) {   // 検索し直して、その ASIN の行が無くなったか
    const end = Date.now() + ms;
    tmSetSearch('');
    const e1 = Date.now() + 1500; while (Date.now() < e1 && tmItems(root).length <= 1) await sleep(80);   // 絞り込み解除が反映されるまで
    tmSetSearch(asin); const t1 = Date.now(); let goneN = 0;
    while (Date.now() < end) {
      await sleep(150);
      const has = tmItems(root).some(x => tmAsinOf(x)[0] === asin);
      goneN = has ? 0 : goneN + 1;
      if (goneN >= 3 && Date.now() - t1 > 450) return true;   // 一瞬の空表示で誤判定しないよう3回連続で確認
    }
    return false;
  }
  function tmFresh(root, asin) {   // その ASIN の行を毎回探し直す（ag-grid は行を描き直すので古い参照は使わない）
    const it = tmItems(root).find(x => tmAsinOf(x)[0] === asin); if (!it) return null;
    let del = null, cancel = null;
    for (const p of it.parts) { const x = p.querySelector('div.delete'); if (x) { del = x; cancel = p.querySelector('div.cancel'); break; } }
    return { it, del, cancel };
  }
  const anyCancel = root => [...root.querySelectorAll('div.cancel')].some(vis);
  async function tmDeleteOne(it, dry) {
    const root = tmRoot(); if (!root) return 'skip:一覧が見つからない';
    const D = []; it.diag = ''; const t0 = Date.now(); const ts = () => ((Date.now() - t0) / 1000).toFixed(1) + 's';
    const before = tmTotal();
    if (!tmSetSearch(it.asin)) return 'skip:検索欄が見つからない';
    const d = await tmWaitOne(root, it.asin, 6000); if (!d) return 'skip:1件に絞れなかった';
    let f = tmFresh(root, it.asin);
    if (!f || !f.del || !vis(f.del)) return 'skip:削除ボタンが見つからない';
    if (dry) return 'dry';
    const done = (r) => { it.diag = D.join(' / '); tm.lastDiag = it.asin + ' ' + it.diag; return r; };
    // ユーザーが「実行」を押した後だけ、この1行の「削除」を押す（一括削除は使わない）。押した後は検索欄・一覧に一切触らない
    const tries = [['イベント列(アイコン)', x => tmFire(x.del.querySelector('i.fa-trash-o, i') || x.del)], ['click()', x => x.del.click()], ['イベント列(削除ボタン)', x => tmFire(x.del)], ['イベント列(セル)', x => tmFire(x.del.closest('[col-id]') || x.del)]];
    let hit = '', kind = '';
    for (const [name, fn] of tries) {
      f = tmFresh(root, it.asin);
      if (!f || !f.del) { kind = '行なし'; break; }
      fn(f);
      const end = Date.now() + 2000;
      while (Date.now() < end) {
        if (anyCancel(root)) { kind = 'cancel表示'; break; }
        const g = tmFresh(root, it.asin);
        if (!g) { kind = '行が消えた'; break; }
        if (g.del && !vis(g.del)) { kind = '削除ボタンが隠れた'; break; }
        await sleep(100);
      }
      D.push(`${name}:${kind || '反応なし'}@${ts()}`);
      if (kind) { hit = name; break; }
    }
    if (!hit) { D.push(`件数${before}`); return done('skip:Keepaが削除ボタンに反応しない'); }
    // 取り消しカウントダウンが終わるまで待つ（cancel が見えている間＋最低6秒）
    // v0.0.33: cancel が消えたら +0.5秒で次へ（最大15秒）。cancel が見えないときは出るのを1.5秒待ち、出なければ4秒待つ
    const tP = Date.now(), maxEnd = tP + 15000; let sawC = kind === 'cancel表示';
    while (Date.now() < maxEnd) {
      const c = anyCancel(root); if (c) sawC = true;
      if (!c && (sawC || Date.now() - tP > 4000)) break;
      if (!c && !sawC && Date.now() - tP > 1500 && Date.now() - tP > 4000) break;
      await sleep(100);
    }
    await sleep(500);
    D.push(`カウントダウン${sawC ? '(cancel見えた)' : '(cancel見えず)'}終了@${ts()}`);
    // 件数が減るのを待つ（フィルターは変えない）
    const after = tmTotal(); const dropped = before && after && after < before;
    D.push(dropped ? `件数${before}→${after}` : '件数まだ');
    // ここで初めて検索し直して確認
    const gone = await tmGone(root, it.asin, 8000);
    D.push(`再検索:${gone ? '消えた' : 'まだある'}@${ts()}`);
    if (dropped && gone) return done('ok');
    if (gone && sawC) { D.push('件数は後から反映'); return done('ok'); }   // v0.0.33: 取り消し表示→終了→再検索で消えた＝削除成功
    if (dropped) { D.push('件数で確認'); return done('ok'); }
    if (gone) { D.push('cancel未確認のため保留'); return done('skip:件数が減らない（Keepaで確認してください）'); }
    D.push('Keepa側で確定しなかった');
    return done('skip:削除を確認できない');
  }
  function tmEntry() {
    if (!isMobile() || document.getElementById('kfm-tm-fab') || !document.body) return;
    const b = el('button', null); b.type = 'button'; b.id = 'kfm-tm-fab';
    b.innerHTML = ICON_PHONE + '<span>スマホ表示に戻る</span>';
    b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); tmOpen(); });
    document.body.appendChild(b);
  }
  function tmAuto() {   // v0.0.33: #!manage を開いたら最初からスマホ用一覧を出す
    if (!isMobile() || !document.body) return;
    kc(document.documentElement, 'kfm-manage', true);
    tmEntry();
    if (!tm.orig && !document.getElementById('kfm-tm') && tmRoot()) tmOpen();
  }
  function tmLeave() { if (tm.running) return; tm.orig = false; kc(document.documentElement, 'kfm-manage', false); const gr = document.querySelector('.kfm-tm-grid'); if (gr) gr.classList.remove('kfm-tm-grid'); ['kfm-tm-fab', 'kfm-tm', 'kfm-tm-sheet'].forEach(i => { const e = document.getElementById(i); if (e) e.remove(); }); kc(document.documentElement, 'kfm-tm-on', false); }
  function tmFiltered() {
    const q = tm.q.toLowerCase();
    return q ? tm.items.filter(i => i.asin.toLowerCase().includes(q) || i.title.toLowerCase().includes(q)) : tm.items;
  }
  function tmRender() {
    const ov = document.getElementById('kfm-tm'); if (!ov) return;
    const list = ov.querySelector('.kfm-tm-list'); list.textContent = '';
    const vis2 = tmFiltered();
    vis2.forEach(it => {
      const row = el('label', 'kfm-tm-card' + (tm.sel.has(it.asin) ? ' on' : ''));
      const cb = el('input'); cb.type = 'checkbox'; cb.checked = tm.sel.has(it.asin);
      cb.addEventListener('change', () => { cb.checked ? tm.sel.add(it.asin) : tm.sel.delete(it.asin); row.classList.toggle('on', cb.checked); tmBar(); });
      const im = el('img'); im.src = it.img; im.alt = ''; im.loading = 'lazy';
      const tx = el('div', 'kfm-tm-tx'); tx.appendChild(el('div', 'kfm-tm-t', it.title)); tx.appendChild(el('div', 'kfm-tm-a', it.asin));
      if (it.prices.length) { const pt = el('div', 'kfm-tm-pt'); it.prices.forEach(p => { const r = el('div', 'kfm-tm-pr'); r.appendChild(el('span', 'kfm-tm-pl', p.lb)); r.appendChild(el('span', 'kfm-tm-pg', p.goal ? '目標 ' + p.goal : '目標 –')); r.appendChild(el('span', 'kfm-tm-pn', p.now ? '今 ' + p.now : '今 –')); pt.appendChild(r); }); tx.appendChild(pt); }
      if (it.res) tx.appendChild(el('div', 'kfm-tm-r ' + (it.res === 'ok' ? 'ok' : it.res === 'dry' ? 'dry' : 'ng'), tmStatus(it.res)));
      const del1 = el('button', 'kfm-tm-del1'); del1.type = 'button'; del1.setAttribute('aria-label', 'このトラッキングを削除'); del1.innerHTML = ICON_TRASH_W;
      del1.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); tmConfirm([it]); });
      const top = el('div', 'kfm-tm-top'); top.append(cb, im, tx, del1); row.appendChild(top); list.appendChild(row);
    });
    if (!vis2.length) list.appendChild(el('div', 'kfm-tm-empty', tm.items.length ? '当てはまる商品がありません' : tm.loading ? '読み込み中…' : '商品を表示できませんでした。右上の ↻ をタップして、もう一度お試しください。'));
    if (tm.loading && vis2.length) list.appendChild(el('div', 'kfm-tm-empty', '続きを読み込んでいます…'));
    const all = ov.querySelector('.kfm-tm-all');
    const allOn = vis2.length > 0 && vis2.every(i => tm.sel.has(i.asin));
    all.querySelector('input').checked = allOn;
    tmBar();
  }
  function tmBar() {
    const ov = document.getElementById('kfm-tm'); if (!ov) return;
    const n = tm.sel.size, go = ov.querySelector('.kfm-tm-go');
    go.querySelector('span').textContent = tm.dry ? `選んだ${n}件で練習` : `選んだ${n}件を削除`;
    go.classList.toggle('dry', tm.dry); go.disabled = !n || tm.running;
    const pb = ov.querySelector('.kfm-tm-prac'); if (pb) pb.hidden = !tm.dry;
    const cn = ov.querySelector('.kfm-tm-cnt'); if (!tm.loading && !cn.classList.contains('warn')) cn.textContent = n ? `${n}件選択中` : 'チェックしてまとめて削除、またはゴミ箱で1件ずつ削除';
    const tt = ov.querySelector('.kfm-tm-tot'); if (tt) tt.textContent = `${tm.total || tm.items.length}件`;
  }
  async function tmLoad() {
    const ov = document.getElementById('kfm-tm'); if (!ov) return;
    const st = ov.querySelector('.kfm-tm-cnt');
    tm.items = []; tm.loading = true; st.classList.remove('warn'); tmRender();
    try {
      tmSetSearch('');
      let lastR = 0;
      const { list, total } = await tmCollect((map, t) => {
        tm.total = t || tm.total;
        if (map.size !== tm.items.length && Date.now() - lastR > 600) { lastR = Date.now(); tm.items = [...map.values()]; tmRender(); }
        st.textContent = `商品を読み込んでいます… ${map.size}${t ? ' / ' + t : ''}件`;
      });
      tm.items = list; tm.total = total || list.length; [...tm.sel].forEach(a => { if (!list.some(i => i.asin === a)) tm.sel.delete(a); });
      tmRender();
      tm.loading = false;
      if (total && list.length < total) { st.textContent = `⚠ ${total}件のうち${list.length}件だけ表示しています。右上の ↻ で読み込み直せます`; st.classList.add('warn'); } else st.classList.remove('warn');
    } catch (e) { tm.dbgNote = String(e.message || e); st.textContent = '⚠ Keepaの一覧を読み込めませんでした。右上の ↻ をタップしてください'; st.classList.add('warn'); }
    tm.loading = false; tmRender();
  }
  function tmOpen() {
    tm.orig = false;
    if (document.getElementById('kfm-tm')) return;
    kc(document.documentElement, 'kfm-tm-on', true);
    const ov = el('div'); ov.id = 'kfm-tm';
    ov.innerHTML = '<div class="kfm-tm-head"><div class="kfm-tm-h"><span class="kfm-tm-ic">' + ICON_BROOM + '</span><div class="kfm-tm-hh"><b>トラッキング整理</b><span class="kfm-tm-tot"></span></div><button type="button" class="kfm-tm-set" aria-label="設定">' + ICON_GEAR + '</button><button type="button" class="kfm-tm-close" aria-label="Keepaの元の画面を表示">' + ICON_MONITOR + '<span>元の画面</span></button></div>' +
      '<div class="kfm-tm-tools"><label class="kfm-tm-all"><input type="checkbox"><span>全て</span></label><input type="search" class="kfm-tm-q" placeholder="商品名・ASINでしぼる" enterkeyhint="search"><button type="button" class="kfm-tm-reload" aria-label="読み込み直す">' + ICON_RELOAD + '</button></div>' +
      '<div class="kfm-tm-sub"><span class="kfm-tm-prac" hidden>練習モード中</span><div class="kfm-tm-cnt"></div><button type="button" class="kfm-tm-ver" aria-label="診断情報"></button></div><pre class="kfm-tm-dbg" hidden></pre></div><div class="kfm-tm-list"></div>' +
      '<div class="kfm-tm-bar"><button type="button" class="kfm-tm-go">' + ICON_TRASH_W + '<span></span></button></div>';
    document.body.appendChild(ov);
    ov.querySelector('.kfm-tm-close').addEventListener('click', () => { if (!tm.running) { tm.orig = true; const gr = document.querySelector('.kfm-tm-grid'); if (gr) gr.classList.remove('kfm-tm-grid'); ov.remove(); kc(document.documentElement, 'kfm-tm-on', false); } });
    const vb = ov.querySelector('.kfm-tm-ver'); vb.textContent = VERSION;
    vb.addEventListener('click', () => { const d = ov.querySelector('.kfm-tm-dbg'); d.hidden = !d.hidden; if (!d.hidden) d.textContent = tmDbg(); });
    ov.querySelector('.kfm-tm-reload').addEventListener('click', () => { if (!tm.running) tmLoad(); });
    ov.querySelector('.kfm-tm-q').addEventListener('input', e => { tm.q = e.target.value.trim(); tmRender(); });
    ov.querySelector('.kfm-tm-all input').addEventListener('change', e => { tmFiltered().forEach(i => e.target.checked ? tm.sel.add(i.asin) : tm.sel.delete(i.asin)); tmRender(); });
    ov.querySelector('.kfm-tm-set').addEventListener('click', () => { if (!tm.running) openSettings(); });
    ov.querySelector('.kfm-tm-go').addEventListener('click', () => tmConfirm());
    tmRender(); tmLoad();
  }
  function tmReason(r) {   // v0.0.33: ふつうの言葉にする（細かい記録は診断表示だけ）
    const c = (r || '').slice(5);
    if (/絞れ|行が見つから|一覧が見つから/.test(c)) return 'Keepaの一覧で見つかりませんでした';
    if (/反応しない|削除ボタンが見つから/.test(c)) return 'Keepaの削除ボタンが反応しませんでした';
    if (/検索欄/.test(c)) return 'Keepaの検索が使えませんでした';
    return 'Keepaで削除を確認できませんでした';
  }
  function tmStatus(r) { return r === 'ok' ? '削除しました ✓' : r === 'dry' ? '練習OK ✓' : r ? 'できませんでした：' + tmReason(r) : ''; }
  function tmConfirm(only) {
    const items = only || tm.items.filter(i => tm.sel.has(i.asin)); if (!items.length || tm.running || document.getElementById('kfm-tm-sheet')) return;
    const sh = el('div'); sh.id = 'kfm-tm-sheet';
    const box = el('div', 'kfm-tm-box');
    box.appendChild(el('div', 'kfm-tm-st', tm.dry ? `練習：${items.length}件` : `この${items.length}件のトラッキングを削除します`));
    box.appendChild(el('div', 'kfm-tm-sn', tm.dry ? '1件ずつ探して、削除できる状態かを確かめます。実際には削除しません。' : '1件ずつKeepaの「削除」ボタンを押します。終わるまでこの画面を閉じないでください。'));
    const ul = el('div', 'kfm-tm-ul'); items.forEach(i => { const r = el('div', 'kfm-tm-li'); r.appendChild(el('span', 'kfm-tm-lt', i.title)); r.appendChild(el('span', 'kfm-tm-ls', '')); ul.appendChild(r); }); box.appendChild(ul);
    const setLs = (li, t, cls) => { const x = li.querySelector('.kfm-tm-ls'); x.textContent = t; x.className = 'kfm-tm-ls ' + (cls || ''); };
    const prog = el('div', 'kfm-tm-prog'); box.appendChild(prog);
    const bt = el('div', 'kfm-tm-btns');
    const no = el('button', 'kfm-tm-no', 'やめる'); no.type = 'button';
    const yes = el('button', 'kfm-tm-yes' + (tm.dry ? ' dry' : ''), tm.dry ? '練習する' : '削除する'); yes.type = 'button';
    bt.append(no, yes); box.appendChild(bt); sh.appendChild(box); document.body.appendChild(sh);
    no.addEventListener('click', () => { if (tm.running) { tm.stop = true; no.textContent = '止めています…'; no.disabled = true; } else sh.remove(); });
    yes.addEventListener('click', async () => {
      tm.running = true; tm.stop = false; yes.disabled = true; yes.style.display = 'none'; no.textContent = '停止'; no.classList.add('kfm-tm-stop'); ul.classList.add('run'); tmBar(); [...ul.children].forEach(li => setLs(li, '待機中', 'wait'));
      let ok = 0, sk = 0, dr = 0; const dry2 = tm.dry;
      for (let k = 0; k < items.length; k++) {
        if (tm.stop) break;
        const it = items[k]; prog.textContent = `${k + 1} / ${items.length}件目を${dry2 ? '確認' : '削除'}しています…`;
        const li = ul.children[k]; li.classList.add('now'); setLs(li, dry2 ? '確認中…' : '削除中…', 'now'); li.scrollIntoView({ block: 'nearest' });
        let r; try { r = await tmDeleteOne(it, dry2); } catch (e) { r = 'skip:エラー'; }
        it.res = r; setLs(li, r === 'ok' ? '削除しました ✓' : r === 'dry' ? '練習OK ✓' : 'できませんでした', r === 'ok' || r === 'dry' ? 'ok' : 'ng');
        if (r !== 'ok' && r !== 'dry') li.appendChild(el('div', 'kfm-tm-why', tmReason(r)));
        tm.diags = (tm.diags || []).concat(`${it.asin} ${r} ${it.diag || ''}`).slice(-10); li.classList.remove('now'); li.classList.add(r === 'ok' ? 'ok' : r === 'dry' ? 'dry' : 'ng');
        if (r === 'ok') { ok++; tm.sel.delete(it.asin); } else if (r === 'dry') dr++; else sk++;
        await sleep(dry2 ? 150 : 200);
      }
      tmSetSearch('');
      const left = items.length - ok - sk - dr;
      prog.textContent = (dry2 ? `練習が終わりました。${dr}件${dr === items.length ? 'とも' : 'は'}削除できる状態です` : `${ok}件を削除しました`) + (sk ? `。${sk}件はできませんでした` : '') + (left ? `（${left}件は止めたので未実行）` : '');
      tm.running = false; no.disabled = false; no.textContent = '閉じる'; no.classList.remove('kfm-tm-stop'); yes.remove();
      if (ok) tm.items = tm.items.filter(i => i.res !== 'ok');
      await sleep(300); tm.total = tmTotal() || tm.items.length; tmBar();
      if (ok) { const want = tm.total; let n = 0; const iv = setInterval(() => { const t = tmTotal(); if (t && t !== tm.total) { tm.total = t; tmBar(); } if (++n > 30 || (t && t < want)) clearInterval(iv); }, 1000); }   // Keepa の件数は遅れて更新される
      tmRender();
    });
  }
  window.addEventListener('hashchange', () => { if (!onManage()) tmLeave(); });
  function run() {
    timer = 0;
    if (mq.matches && document.body) { try { numericKeyboards(); } catch (e) {} verBadge(); }
    if (isTyping()) { timer = setTimeout(run, 1000); return; }
    if (scrollBusy()) { timer = setTimeout(run, 400); return; }   // v0.0.33: スクロール中はDOMを触らない
    kfmCleanup();   // 入力中はDOMを一切触らない
    const on = mq.matches;
    const H = document.documentElement;
    kc(H, 'kfm', on);
    kc(H, 'kfm-finder', on && onFinder());
    kc(H, 'kfm-product', on && onProduct());
    if (!onFinder()) leaveFinder();
    if (!onProduct()) leaveProduct();
    if (onManage()) tmAuto(); else tmLeave();
    if (onProduct()) { trackAutoOpen(); trackTick(); setViewport(); }
    else if (trackOn) trackTick();
    if (!on || !document.body) return;
    setViewport(); badge();
    busy = true;
    try { cardify(); if (onFinder()) { groupChecks(); fixRanges(); numericKeyboards(); bottomBar(); filterEdit(); activeFilterPopup(); const l = document.getElementById('kfm-list'); if (l) sortBar(l); fixOverflow(); } colSheetTick(); acTick();
      if (onFinder()) { const w = document.querySelector('.ag-root-wrapper'), pg = document.getElementById('kfm-pager');   // v0.1.18: 画面の切り替わりを取りこぼさない
        if (w && (!pg || (pg.style.display === 'none') === finderResultsViewActive())) { try { updatePager(w); } catch (e) {} } } }
    finally { setTimeout(() => { busy = false; }, 0); }
  }
  const schedule = () => { if (!busy && !timer) timer = setTimeout(run, isTyping() ? 1000 : 250); };
  // v0.0.33: スクロールを止めうるもの（ロック用クラス・全画面の透明レイヤー・置き去りの画面）を片付ける。何度呼んでもよい
  function kfmCleanup() {
    const H = document.documentElement;
    const ov = document.getElementById('kfm-tm'), sheet = document.getElementById('kfm-tm-sheet');
    if (!onManage()) {
      if (tm.running) tm.stop = true;
      if (!tm.running) { [ov, sheet, document.getElementById('kfm-tm-fab')].forEach(e => e && e.remove()); }
      kc(H, 'kfm-manage', false);
      document.querySelectorAll('.kfm-tm-grid').forEach(g => g.classList.remove('kfm-tm-grid'));
    }
    if (!document.getElementById('kfm-tm')) {
      kc(H, 'kfm-tm-on', false);
      if (onManage()) document.querySelectorAll('.kfm-tm-grid').forEach(g => g.classList.remove('kfm-tm-grid'));
    }
    if (sheet && !document.getElementById('kfm-tm') && !tm.running) sheet.remove();
    if (!onProduct() && H.classList.contains('kfm-track')) { trackOn = false; kc(H, 'kfm-track', false); const b = document.getElementById('kfm-trackbar'); if (b) b.remove(); }
    [H, document.body].forEach(e => { if (!e) return; ['overflow', 'overflow-y', 'position', 'touch-action', 'height'].forEach(pr => { if (e.style.getPropertyValue(pr)) e.style.removeProperty(pr); }); });
  }
  window.addEventListener('hashchange', () => { kfmCleanup(); setTimeout(kfmCleanup, 300); });
  window.addEventListener('pageshow', () => kfmCleanup());
  setInterval(() => { try { kfmCleanup(); } catch (e) {} }, 2000);   // 見張り: 画面が開いていないのに残ったロックを外す
  // ==KFM-TABS-BEGIN== v0.1.1: 製品ファインダー以外のタブのスマホ表示（v0.1.22: 600px メディアクエリを外し全 iPhone 幅で適用）
  const KFM_ROUTES = ['deals', 'tracking', 'manage', 'notification', 'viewer', 'bestseller', 'topseller', 'sellerlookup', 'categorytree'];
  function routeName() { const m = /^#!([a-z]+)/i.exec(location.hash || ''); return m ? m[1].toLowerCase() : ''; }
  function applyRoute() {
    const H = document.documentElement, r = routeName();
    [...H.classList].forEach(c => { if (c.indexOf('kfm-route-') === 0 && c !== 'kfm-route-' + r) H.classList.remove(c); });
    const on = isMobile() && KFM_ROUTES.indexOf(r) >= 0;
    kc(H, 'kfm-tabs', on);
    kc(H, 'kfm-route-' + r, on && !!r);
  }
  const T = 'html.kfm-tabs';
  const R = n => 'html.kfm-route-' + n;
  const TABS_CSS = `
${T},${T} body{max-width:100%!important;overflow-x:hidden!important}
${T} #contentAlign,${T} #bodyPanel,${T} #contentAlign[data-layout]{width:auto!important;max-width:100%!important;min-width:0!important;margin-left:0!important;margin-right:0!important;padding-left:max(8px,env(safe-area-inset-left,0px))!important;padding-right:max(8px,env(safe-area-inset-right,0px))!important;box-sizing:border-box!important;left:auto!important;--col-min:0!important;--col-max:100%!important;--col-side:0px!important}
${T} #bodyPanel>.card,${T} #bodyPanel>span.card{width:auto!important;max-width:100%!important;min-width:0!important;box-sizing:border-box!important;margin-left:0!important;margin-right:0!important}
${T} .knav-sub{max-width:100%!important;overflow:hidden!important}
${T} .knav-sub__inner{display:flex!important;flex-wrap:nowrap!important;align-items:center;overflow-x:auto!important;-webkit-overflow-scrolling:touch;scrollbar-width:none;gap:4px;padding:0 8px!important;max-width:100%!important;box-sizing:border-box}
${T} .knav-sub__link{flex:0 0 auto!important;white-space:nowrap!important;min-height:40px;display:inline-flex!important;align-items:center;font-size:14px!important}
${T} .knav-sub .knav-sub__aside,${T} .knav-sub #widget__bucket_quota{display:none!important}
${T} .data-container{width:auto!important;max-width:100%!important;min-width:0!important;box-sizing:border-box!important;overflow:hidden!important}
${T} .grid-wrapper{width:auto!important;max-width:100%!important;box-sizing:border-box!important;border:1px solid #d5d9df;overflow:hidden!important}
${T} .grid-wrapper .grid,${T} .grid-wrapper .ag-root-wrapper:not(.kfm-gridhost){width:100%!important;max-width:100%!important;box-sizing:border-box!important}
${T} .grid-wrapper .ag-paging-panel{flex-wrap:wrap!important;height:auto!important;min-height:48px;gap:8px;font-size:14px!important;justify-content:center!important}
${T} .grid-wrapper .ag-paging-button{min-width:40px;min-height:40px;display:inline-flex!important;align-items:center;justify-content:center}
${T} .grid-wrapper .ag-header-cell-text,${T} .grid-wrapper .ag-cell{font-size:14px!important}
${T} .grid-wrapper-tools{max-width:100%!important;box-sizing:border-box!important;height:auto!important}
${T} .grid-wrapper-tools>div:first-child{display:flex!important;flex-wrap:wrap!important;gap:8px;max-width:100%;width:auto!important;float:none!important}
${T} .grid-wrapper-tools>div:first-child>span{float:none!important;position:static!important;flex:0 0 auto}
${T} .grid-wrapper-tools .trigger{min-height:40px;display:inline-flex!important;align-items:center;font-size:14px!important}
${R('deals')} #leftPanel{position:static!important;float:none!important;width:auto!important;max-width:100%!important;min-width:0!important;margin-top:60px!important;max-height:45vh;overflow-y:auto!important;box-sizing:border-box;border-bottom:1px solid #ddd;padding:0 8px}
${R('deals')} #contentAlign{margin-top:8px!important;position:static!important}
${R('deals')} #dealSearchBar{font-size:16px!important;min-height:40px;width:100%!important;box-sizing:border-box}
${R('deals')} #leftPanel .panelBox__header{min-height:40px;font-size:15px!important}
${R('deals')} #leftPanel .panelChip,${R('deals')} #leftPanel .panelChoice,${R('deals')} #leftPanel .panelCheck,${R('deals')} #dealsViewType>div{min-height:40px;font-size:14px!important}
${R('deals')} #filterBar,${R('deals')} .filterContainer{width:auto!important;max-width:100%!important}
${R('deals')} #filterCats.catGrid{display:grid!important;grid-template-columns:1fr!important;grid-template-rows:none!important;grid-auto-flow:row!important;column-gap:0!important}
${R('deals')} .catRow{display:flex!important;align-items:center;min-height:40px}
${R('deals')} .catRow__pick{flex:1 1 auto!important;min-width:0;min-height:40px;display:flex!important;align-items:center;gap:6px;font-size:14px!important}
${R('deals')} .catRow__name{white-space:normal!important;overflow:visible!important;text-overflow:clip!important;flex:1 1 auto;text-align:left}
${R('deals')} .catRow__add,${R('deals')} .catRow__x{min-width:40px;min-height:40px}
${R('deals')} #productPage0.productPage,${R('deals')} .productPage{display:flex!important;flex-wrap:wrap!important;justify-content:center;gap:8px}
${R('deals')} .productContainer{min-width:0!important;width:calc(50% - 8px)!important;box-sizing:border-box}
${R('deals')} .productContainer .title{max-width:100%!important}
${R('tracking')} .dashboard .grid{display:grid!important;grid-template-columns:1fr!important;gap:10px}
${R('tracking')} .dashboard .card{width:auto!important;max-width:100%!important;margin:0!important;box-sizing:border-box}
${R('manage')} #kfm-tm-fab{right:max(12px,env(safe-area-inset-right));max-width:calc(100% - 24px);white-space:nowrap}
${R('manage')} #kfm-ver{max-width:calc(100% - 16px)}
${R('notification')} #bodyPanel>.group-header{font-size:18px!important;margin-left:0!important;padding:0 4px!important;word-break:break-word}
${R('notification')} #notificationFilter{text-align:left!important}
${R('notification')} #notificationFilterForm{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
${R('notification')} #notificationFilterForm label{font-size:14px!important;margin-left:0!important}
${R('notification')} #notificationContent,${R('notification')} #notificationsBox{max-width:100%!important;overflow-x:auto;font-size:14px}
${R('viewer')} .viewer-import,${R('viewer')} #importForm{max-width:100%!important;min-width:0!important}
${R('viewer')} #importShelf{display:flex!important;flex-wrap:wrap!important;gap:6px;width:100%!important;max-width:100%!important;height:auto!important;overflow:visible!important;box-sizing:border-box}
${R('viewer')} #importShelf>.viewer-import__pill{flex:1 1 30%!important;min-width:0!important;width:auto!important;max-width:100%!important;white-space:normal!important;min-height:40px;height:auto!important;padding:6px 8px!important;font-size:13px!important;line-height:1.2!important;box-sizing:border-box}
${R('viewer')} #importInputList,${R('viewer')} #importInputOne{width:100%!important;max-width:100%!important;box-sizing:border-box!important;font-size:16px!important}
${R('viewer')} #importInputList{min-height:140px}
${R('viewer')} #importInputOne{min-height:40px}
${R('viewer')} .viewer-import__status,${R('viewer')} .viewer-import__actions,${R('viewer')} #importOptions{display:flex!important;flex-wrap:wrap!important;gap:8px;max-width:100%}
${R('viewer')} #importSubmit,${R('viewer')} #viewerImportFileTrigger{min-height:40px}
${R('bestseller')} #besteller-category-container{width:auto!important;max-width:100%!important}
${R('bestseller')} #bestSellerCategoryGrid.catGrid{display:grid!important;grid-template-columns:1fr!important;grid-template-rows:none!important;grid-auto-flow:row!important;column-gap:0!important}
${R('bestseller')} #bestSellerCategoryGrid>a{display:block!important;font-size:15px!important;padding:10px 4px!important;min-height:40px;box-sizing:border-box;border-bottom:1px solid #eee}
${R('topseller')} #grid-wrapper-seller{width:auto!important}
${R('sellerlookup')} #bodyPanel>.card.-w-min-800{min-width:0!important}
${R('sellerlookup')} .seller-lookup__searchrow{display:flex!important;flex-direction:column!important;align-items:stretch!important;gap:8px}
${R('sellerlookup')} .seller-lookup__input,${R('sellerlookup')} .seller-lookup__input .mdc-text-field{width:100%!important;max-width:100%!important}
${R('sellerlookup')} .seller-lookup__input .mdc-text-field{height:auto!important;display:flex!important;flex-direction:column-reverse!important}
${R('sellerlookup')} .seller-lookup__input .mdc-floating-label{position:static!important;transform:none!important;display:block!important;font-size:13px!important;margin:0 0 4px!important}
${R('sellerlookup')} .seller-lookup__input input#sellerLookupId.mdc-text-field__input{border:1px solid #c9ced6!important;border-radius:6px;padding:0 10px!important;height:40px!important;font-size:16px!important;box-sizing:border-box;width:100%!important}
${R('sellerlookup')} .seller-lookup__options{display:flex!important;flex-wrap:wrap!important;gap:8px}
${R('sellerlookup')} #sellerLookupShelf:not([hidden]),${R('sellerlookup')} #sellerLookupChips:not([hidden]){display:flex!important;flex-wrap:wrap!important;gap:8px;max-width:100%}
${R('sellerlookup')} .seller-lookup__pill{min-height:40px;font-size:14px!important}
${R('sellerlookup')} #sellerLookupResults{max-width:100%!important;overflow-x:auto!important;-webkit-overflow-scrolling:touch}
${R('categorytree')} #grid-wrapper-category{width:auto!important}
${R('categorytree')} #grid-category .ag-root-wrapper{position:relative!important;left:0!important;width:100%!important}
${T} .content-column{max-width:100%!important;box-sizing:border-box;left:max(8px,env(safe-area-inset-left,0px))!important;right:max(8px,env(safe-area-inset-right,0px))!important;width:auto!important}
${R('categorytree')} #grid-tools-categorytree .content-column{max-width:100%!important;box-sizing:border-box}
`;
  (function initTabs() {
    const add = () => {
      if (document.getElementById('kfm-tabs-css')) return;
      const s = document.createElement('style'); s.id = 'kfm-tabs-css'; s.textContent = TABS_CSS;
      (document.head || document.documentElement).appendChild(s);
    };
    add(); applyRoute();
    window.addEventListener('hashchange', applyRoute);
    window.addEventListener('resize', () => { if (kfmWidthChanged('rt')) applyRoute(); });
    document.addEventListener('DOMContentLoaded', () => { add(); applyRoute(); });
  })();
  // ==KFM-TABS-END==
  function start() {
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('hashchange', schedule);
    window.addEventListener('resize', () => { if (kfmWidthChanged('sc')) schedule(); });
    document.addEventListener('focusout', () => setTimeout(schedule, 300), true);
    run();
  }
  kc(document.documentElement, 'kfm', isMobile());
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
