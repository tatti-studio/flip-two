// 同期まわりの純粋関数（テスト対象）
import type { Memory, Settings, TopicPrefs } from '../lib/types';
import type { Shared } from './types';

/** キーの順番に左右されない JSON 文字列（同期の「変わったか」判定に使う） */
export function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object')
    return `{${Object.keys(v as object)
      .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  return JSON.stringify(v ?? null);
}

/** 共有する項目だけを取り出す（受信データに余計な項目があっても揃える） */
export function pickShared(settings: Settings, prefs: TopicPrefs): Shared {
  return {
    settings: {
      names: settings.names,
      anniversary: settings.anniversary ?? null,
      veto: settings.veto,
      onceShare: settings.onceShare,
      seasonMode: settings.seasonMode,
      hideVotes: settings.hideVotes ?? false,
      includeDone: settings.includeDone ?? false,
    },
    prefs: { disabled: prefs.disabled ?? [], custom: prefs.custom ?? [], once: prefs.once ?? [] },
  };
}

/** 前回同期した状態と今の一覧を比べて、送るべき追加・更新と削除を出す */
export function diffMemories(prev: Map<string, string>, list: Memory[]) {
  const upserts: Memory[] = [];
  const now = new Set<string>();
  for (const m of list) {
    now.add(m.id);
    if (prev.get(m.id) !== stable(m)) upserts.push(m);
  }
  const removes = [...prev.keys()].filter((id) => !now.has(id));
  return { upserts, removes };
}

/** 招待コード: 推測されにくい英数字 24 文字 */
export function makeRoomId(rand: () => number = Math.random): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let out = '';
  const bytes = new Uint8Array(24);
  try {
    crypto.getRandomValues(bytes);
  } catch {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(rand() * 256);
  }
  for (const b of bytes) out += chars[b % chars.length];
  return out;
}

/** 招待リンクやQRから読んだ文字列から、招待コードを取り出す */
export function parseInvite(input: string): string | null {
  const s = input.trim();
  const m = s.match(/[?&#]join=([A-Za-z0-9]{20,64})/);
  if (m) return m[1];
  if (/^[A-Za-z0-9]{20,64}$/.test(s)) return s;
  return null;
}

/** 両方の端末の記録を合わせる。同じ記録が両方にあれば、やった・ひとこと・写真を足し合わせる */
export function mergeMemories(a: Memory[], b: Memory[]): Memory[] {
  const map = new Map<string, Memory>();
  for (const m of [...a, ...b]) {
    const cur = map.get(m.id);
    if (!cur) map.set(m.id, m);
    else
      map.set(m.id, {
        ...cur,
        done: cur.done || m.done,
        notes: [cur.notes[0] || m.notes[0], cur.notes[1] || m.notes[1]],
        photoIds: Array.from(new Set([...cur.photoIds, ...m.photoIds])),
      });
  }
  return [...map.values()].sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : 0));
}
