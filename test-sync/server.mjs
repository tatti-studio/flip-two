// 動作確認用: Firebase の代わりに使う、メモリ上だけの小さなサーバー
import { createServer } from 'node:http';
const db = new Map(); // path -> json
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,PUT,DELETE,OPTIONS', 'access-control-allow-headers': 'content-type' };
createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return res.writeHead(204, cors).end();
  const url = new URL(req.url, 'http://x');
  const path = url.pathname;
  let body = '';
  for await (const c of req) body += c;
  if (req.method === 'PUT') { db.set(path, body); console.log('PUT', path); return res.writeHead(200, cors).end('{}'); }
  if (req.method === 'DELETE') { db.delete(path); console.log('DELETE', path); return res.writeHead(200, cors).end('{}'); }
  if (url.searchParams.get('list') === '1') {
    const items = [...db.entries()].filter(([k]) => k.startsWith(path + '/') && !k.slice(path.length + 1).includes('/')).map(([, v]) => JSON.parse(v));
    return res.writeHead(200, { ...cors, 'content-type': 'application/json' }).end(JSON.stringify(items));
  }
  if (!db.has(path)) return res.writeHead(404, cors).end('null');
  res.writeHead(200, { ...cors, 'content-type': 'application/json' }).end(db.get(path));
}).listen(8787, () => console.log('fake server on 8787'));
