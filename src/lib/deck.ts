import type { Filter, Season, Topic } from './types';

export type Rng = () => number;

export function seasonOf(date: Date): Exclude<Season, 'any'> {
  const m = date.getMonth() + 1;
  if (m >= 3 && m <= 5) return 'spring';
  if (m >= 6 && m <= 8) return 'summer';
  if (m >= 9 && m <= 11) return 'autumn';
  return 'winter';
}

/** 条件に合うお題か */
export function matches(t: Topic, f: Filter, season: Exclude<Season, 'any'>): boolean {
  if (f.places.length > 0 && t.place !== 'any' && !f.places.includes(t.place)) return false;
  if (f.maxBudget !== null && (t.budget === null || t.budget > f.maxBudget)) return false;
  if (t.minutes > f.maxMinutes) return false;
  if (f.timeOfDay !== 'any' && t.timeOfDay !== 'any' && t.timeOfDay !== f.timeOfDay) return false;
  if (t.season !== 'any' && t.season !== season) return false;
  return true;
}

export function filterDeck(topics: Topic[], f: Filter, season: Exclude<Season, 'any'>): Topic[] {
  return topics.filter((t) => matches(t, f, season));
}

export function shuffle<T>(items: T[], rng: Rng = Math.random): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 重み付きで1枚引く。通常のお題は重み 1、今回だけのお題は重み boost。
 * exclude の id（拒否権で引き直したものなど）は引かない。引けるものがなければ null。
 */
export function drawWeighted(
  items: { id: string; weight: number }[],
  exclude: string[] = [],
  rng: Rng = Math.random,
): string | null {
  const ex = new Set(exclude);
  const pool = items.filter((it) => !ex.has(it.id) && it.weight > 0);
  const total = pool.reduce((sum, it) => sum + it.weight, 0);
  if (total <= 0) return null;
  let r = rng() * total;
  for (const it of pool) {
    r -= it.weight;
    if (r < 0) return it.id;
  }
  return pool[pool.length - 1].id;
}

/**
 * 今回だけのお題1枚あたりの重み。通常のお題は重み 1。
 * 今回だけのお題のどれかが出る確率がちょうど share（0〜1）になるように決める。
 * 通常のお題が0枚なら、今回だけのお題だけから引く。
 */
export function onceWeight(normalCount: number, onceCount: number, share: number): number {
  if (onceCount === 0) return 0;
  if (normalCount === 0) return 1;
  return ((share / (1 - share)) * normalCount) / onceCount;
}

/** 今回だけのお題のどれかが出る確率（0〜1） */
export function onceChance(normalCount: number, onceCount: number, share: number): number {
  if (onceCount === 0) return 0;
  if (normalCount === 0) return 1;
  return share;
}

/** 重み付きで n 枚、重複なしで引く */
export function drawManyWeighted(
  items: { id: string; weight: number }[],
  n: number,
  exclude: string[] = [],
  rng: Rng = Math.random,
): string[] {
  const out: string[] = [];
  const ex = [...exclude];
  for (let i = 0; i < n; i++) {
    const id = drawWeighted(items, ex, rng);
    if (!id) break;
    out.push(id);
    ex.push(id);
  }
  return out;
}

export type Vote = 'yes' | 'no';

/** ふたりの「あり／なし」から、ふたりとも「あり」のカードと、どちらかが「あり」のカードを出す */
export function matchVotes(ids: string[], a: Record<string, Vote>, b: Record<string, Vote>) {
  const both = ids.filter((id) => a[id] === 'yes' && b[id] === 'yes');
  const either = ids.filter((id) => a[id] === 'yes' || b[id] === 'yes');
  return { both, either };
}
