// AI でお題をまとめて作るための、プロンプト作成と答えの読み込み（画面から切り離した純粋関数）
import type { Budget, Minutes, Place, Season, TimeOfDay, Topic } from './types';

export type Draft = Omit<Topic, 'id' | 'source'>;

export type DraftCheck = {
  draft: Draft;
  /** same = 同じお題がある（追加しない） / similar = 似たお題がある / new = 新しい */
  status: 'same' | 'similar' | 'new';
  match?: string; // 同じ・似ているお題の本文
};

const PLACE: Record<string, Place> = { おうち: 'home', 家: 'home', 近所: 'near', おでかけ: 'out', 外出: 'out', どこでも: 'any' };
const TOD: Record<string, TimeOfDay> = { 昼: 'day', 朝: 'day', 夜: 'night', いつでも: 'any' };
const SEASON: Record<string, Season> = { 春: 'spring', 夏: 'summer', 秋: 'autumn', 冬: 'winter', いつでも: 'any' };

export function buildPrompt(opts: { existing: Topic[]; categories: string[]; count: number; theme: string }): string {
  const theme = opts.theme.trim() || '指定なし（いろいろなカテゴリ・場所・予算からバランスよく）';
  const list = opts.existing.map((t) => `- ${t.text}`).join('\n');
  return `あなたは、カップルが「次なにする？」を決めるアプリ「Flip Two」のお題を考える担当です。
ふたりで実際にやりたくなる、デートや過ごし方のお題を作ってください。

# 作ってほしいもの
- お題を ${opts.count} 個
- テーマ: ${theme}

# お題の書き方
- 「どこで・何を・どうするか」がひと目で分かる具体的な一文にする（15〜40文字くらい）
- 実在するお店やチェーン店の名前を入れてもよい（例: コメダ珈琲、サイゼリヤ、ダイソー）
- ふたりで本当にできる、変わりすぎていない内容にする。誰が見ても大丈夫な内容にする
- 下の「すでにあるお題」と同じもの・言い換えただけのものは作らない
- 作るお題どうしも重ならないようにする

# 出力のしかた（これ以外は何も書かない。前置き・説明・番号・コードブロックは不要）
1行に1つ、「|」で区切って次の7項目を書く:
カテゴリ|お題|場所|予算|時間|時間帯|季節

- カテゴリ: ${opts.categories.join(' / ')} のどれか（どうしても合わなければ新しい名前でもよい）
- 場所: おうち / 近所 / おでかけ / どこでも
- 予算（ふたり合計の上限、円）: 0 / 2000 / 5000 / 10000 / なし（1万円より上）
- 時間（分）: 30 / 120 / 240 / 480
- 時間帯: 昼 / 夜 / いつでも
- 季節: 春 / 夏 / 秋 / 冬 / いつでも

例:
カフェ・スイーツ|コメダ珈琲でシロノワールを半分こする|近所|2000|120|いつでも|いつでも
季節・イベント|お月見をして、お団子を食べる|近所|2000|30|夜|秋

# すでにあるお題（${opts.existing.length}個。これと重ならないように）
${list}
`;
}

function parseBudget(s: string): Budget {
  const v = s.replace(/[,，円〜~\s]/g, '');
  if (/なし|上限|以上|null/i.test(v) || v === '') return null;
  const n = Number(v.replace(/万/, '0000'));
  if (!Number.isFinite(n)) return null;
  if (n <= 0) return 0;
  if (n <= 2000) return 2000;
  if (n <= 5000) return 5000;
  if (n <= 10000) return 10000;
  return null;
}

function parseMinutes(s: string): Minutes {
  const n = Number(s.replace(/[^\d.]/g, ''));
  if (/1日|一日/.test(s)) return 480;
  if (/半日/.test(s)) return 240;
  if (!Number.isFinite(n) || n <= 0) return 120;
  const min = /時間/.test(s) ? n * 60 : n;
  if (min <= 30) return 30;
  if (min <= 120) return 120;
  if (min <= 240) return 240;
  return 480;
}

const pick = <T,>(map: Record<string, T>, s: string, fallback: T): T => {
  const key = Object.keys(map).find((k) => s.includes(k));
  return key ? map[key] : fallback;
};

/** AI の答えを読み込む。形式が少し崩れていても、読めるところは読む */
export function parseOutput(text: string): { drafts: Draft[]; skipped: string[] } {
  const drafts: Draft[] = [];
  const skipped: string[] = [];
  // 区切り（|）のある行が1つでもあれば、区切りのない行は前置きや説明とみなして読まない
  const delimited = /[|｜\t]/.test(text);
  for (const raw of text.split(/\r?\n/)) {
    const line = raw
      .trim()
      .replace(/^```.*$/, '')
      .replace(/^[-*・•]\s*/, '')
      .replace(/^\d+[.)．、]\s*/, '');
    if (!line || /^カテゴリ\s*[|｜]/.test(line)) continue;
    const parts = line.split(/\s*[|｜\t]\s*/).map((p) => p.trim());
    if (parts.length >= 2 && parts[1].length >= 4) {
      const [category, body, place = '', budget = '', minutes = '', tod = '', season = ''] = parts;
      drafts.push({
        category: category || 'AIのお題',
        text: body.replace(/^「|」$/g, ''),
        place: pick(PLACE, place, 'any'),
        budget: parseBudget(budget),
        minutes: parseMinutes(minutes),
        timeOfDay: pick(TOD, tod, 'any'),
        season: pick(SEASON, season, 'any'),
      });
    } else if (!delimited && parts.length === 1 && line.length >= 6 && line.length <= 80 && !/[:：]$/.test(line)) {
      // 区切りなしで本文だけが来たとき
      drafts.push({ category: 'AIのお題', text: line, place: 'any', budget: null, minutes: 120, timeOfDay: 'any', season: 'any' });
    } else {
      skipped.push(raw.trim());
    }
  }
  return { drafts, skipped };
}

/** 比べるために、記号や空白を取り除く */
export function normalize(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s、。，．,.・「」『』（）()！!？?〜~ー―-]/g, '');
}

function bigrams(s: string): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
  return out;
}

/** 2つのお題がどれくらい似ているか（0〜1） */
export function similarity(a: string, b: string): number {
  const x = bigrams(normalize(a));
  const y = bigrams(normalize(b));
  if (x.size === 0 || y.size === 0) return 0;
  let inter = 0;
  for (const g of x) if (y.has(g)) inter++;
  return inter / (x.size + y.size - inter);
}

/** 今あるお題・同じ答えの中の前の行と比べて、同じ／似ているを判定する */
export function checkDrafts(drafts: Draft[], existing: string[], threshold = 0.35): DraftCheck[] {
  const seen = existing.map((t) => ({ t, n: normalize(t) }));
  const out: DraftCheck[] = [];
  for (const d of drafts) {
    const n = normalize(d.text);
    const same = seen.find((s) => s.n === n || (n.length >= 8 && (s.n.includes(n) || n.includes(s.n)) && Math.min(n.length, s.n.length) / Math.max(n.length, s.n.length) > 0.7));
    if (same) {
      out.push({ draft: d, status: 'same', match: same.t });
      continue;
    }
    let best = { t: '', v: 0 };
    for (const s of seen) {
      const v = similarity(d.text, s.t);
      if (v > best.v) best = { t: s.t, v };
    }
    out.push(best.v >= threshold ? { draft: d, status: 'similar', match: best.t } : { draft: d, status: 'new' });
    seen.push({ t: d.text, n });
  }
  return out;
}
