// テスト専用のあとで見るバックエンド。本物の Web App や本物のキーは使わない。
import { createServer } from 'node:http';

export const TEST_KEY = 'kfm-test-key-not-secret';

const ASIN_OK = /^[A-Z0-9]{10}$/;

function seedItems() {
  return [
    {
      asin: 'B0TESTASIN', title: 'ワイヤレスイヤホン ノイズキャンセリング',
      breakEven: 4002, price: 4980, monthlySold: '320', rank: '1,234',
      buyBox: '¥4,980', newPrice: '¥5,280',
      keepaUrl: 'https://keepa.com/#!product/5-B0TESTASIN',
      amazonUrl: 'https://www.amazon.co.jp/dp/B0TESTASIN',
      sentAt: '2026-10-01T00:00:00+09:00', addedAt: '2026-10-01T00:00:00.000Z'
    },
    {
      asin: 'B0BOTTLE01', title: 'ステンレス水筒 500ml 保温保冷',
      breakEven: 1222, price: 1680, monthlySold: '210', rank: '3,450',
      buyBox: '¥1,680', newPrice: '¥1,780',
      keepaUrl: 'https://keepa.com/#!product/5-B0BOTTLE01',
      amazonUrl: 'https://www.amazon.co.jp/dp/B0BOTTLE01',
      sentAt: '2026-10-02T00:00:00+09:00', addedAt: '2026-10-02T00:00:00.000Z'
    }
  ];
}

export function createMockGas() {
  const items = new Map(seedItems().map(it => [it.asin, { ...it }]));
  const log = { posts: [], gets: [], options: 0 };

  const json = (res, obj) => {
    res.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*'
    });
    res.end(JSON.stringify(obj));
  };

  const srv = createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (req.method === 'OPTIONS') {
      log.options++;
      res.writeHead(404);
      res.end();
      return;
    }
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      const key = url.searchParams.get('key');
      const actionQ = url.searchParams.get('action');
      if (req.method === 'GET') log.gets.push({ action: actionQ, asin: url.searchParams.get('asin'), key: key ? 'set' : '' });
      if (req.method === 'POST') {
        log.posts.push({
          ctype: String(req.headers['content-type'] || ''),
          action: actionQ,
          len: raw.length
        });
      }
      if (key !== TEST_KEY) return json(res, { ok: false, error: 'unauthorized' });
      let body = {};
      if (raw) { try { body = JSON.parse(raw); } catch (e) { return json(res, { ok: false, error: 'bad json' }); } }
      const action = actionQ || body.action;
      if (req.method === 'GET' && action === 'list') {
        return json(res, { ok: true, items: [...items.values()].sort((a, b) => String(b.addedAt).localeCompare(String(a.addedAt))) });
      }
      if (req.method === 'GET' && action === 'exists') {
        const asin = String(url.searchParams.get('asin') || '');
        return json(res, { exists: items.has(asin) });
      }
      if (req.method === 'POST' && (body.action === 'add' || action === 'add')) {
        const item = body.item || {};
        const asin = String(item.asin || '').trim();
        if (!ASIN_OK.test(asin)) return json(res, { ok: false, error: 'bad asin' });
        if (items.has(asin)) return json(res, { ok: false, duplicate: true, addedAt: items.get(asin).addedAt });
        const row = { ...item, addedAt: new Date().toISOString() };
        items.set(asin, row);
        return json(res, { ok: true, duplicate: false });
      }
      if (req.method === 'POST' && (body.action === 'delete' || action === 'delete')) {
        const asin = String(body.asin || url.searchParams.get('asin') || '');
        if (!items.has(asin)) return json(res, { ok: false, notFound: true });
        items.delete(asin);
        return json(res, { ok: true });
      }
      json(res, { ok: false, error: 'unknown action' });
    });
  });

  return new Promise(resolve => {
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      resolve({
        srv,
        port,
        url: 'http://127.0.0.1:' + port + '/exec',
        key: TEST_KEY,
        items,
        log,
        close: () => new Promise(r => srv.close(r))
      });
    });
  });
}
