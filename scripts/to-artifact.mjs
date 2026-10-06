// dist-artifact/index.html を公開ページ用の断片（doctype/html/head/body なし）に変換する
import { readFileSync, writeFileSync } from 'node:fs';
const html = readFileSync('dist-artifact/index.html', 'utf8');
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
const keep = head
  .split('\n')
  .filter((l) => !/<meta charset|<meta name="viewport"|rel="icon"|apple-|rel="manifest"/.test(l))
  .join('\n');
writeFileSync('dist-artifact/flip-two.html', `${keep.trim()}\n${body.trim()}\n`);
console.log('wrote dist-artifact/flip-two.html');
