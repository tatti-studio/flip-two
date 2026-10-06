import { describe, expect, it } from 'vitest';
import { buildPrompt, checkDrafts, parseOutput } from './aiImport';
import { diffMemories, makeRoomId, mergeMemories, parseInvite, stable } from '../sync/engine';
import { BUILTIN_TOPICS, CATEGORIES } from '../data/topics';
import { drawManyWeighted, drawWeighted, filterDeck, matchVotes, matches, onceChance, onceWeight, seasonOf } from './deck';
import type { Filter } from './types';

const ALL: Filter = { places: [], maxBudget: null, maxMinutes: 480, timeOfDay: 'any' };

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe('topics', () => {
  it('has unique ids and texts, and many categories', () => {
    expect(BUILTIN_TOPICS.length).toBeGreaterThanOrEqual(420);
    expect(CATEGORIES.length).toBe(27);
    expect(new Set(BUILTIN_TOPICS.map((t) => t.id)).size).toBe(BUILTIN_TOPICS.length);
    expect(new Set(BUILTIN_TOPICS.map((t) => t.text)).size).toBe(BUILTIN_TOPICS.length);
  });

  it('keeps the first 52 ids stable', () => {
    expect(BUILTIN_TOPICS[0].id).toBe('b001');
    expect(BUILTIN_TOPICS.find((t) => t.id === 'b052')!.text).toContain('ダンス');
    // 外したお題は出てこない
    expect(BUILTIN_TOPICS.some((t) => t.text.includes('押したことのないボタン'))).toBe(false);
  });

  it('every topic fits at least one realistic filter', () => {
    for (const t of BUILTIN_TOPICS) expect(matches(t, ALL, t.season === 'any' ? 'autumn' : t.season)).toBe(true);
  });
});

describe('deck', () => {
  it('maps months to seasons', () => {
    expect(seasonOf(new Date(2026, 9, 6))).toBe('autumn');
    expect(seasonOf(new Date(2026, 0, 1))).toBe('winter');
    expect(seasonOf(new Date(2026, 6, 1))).toBe('summer');
  });

  it('filters by place, budget, time and season', () => {
    const fireworks = BUILTIN_TOPICS.find((t) => t.text.includes('線香花火'))!;
    expect(matches(fireworks, ALL, 'summer')).toBe(true);
    expect(matches(fireworks, ALL, 'autumn')).toBe(false);
    const home: Filter = { ...ALL, places: ['home'], maxBudget: 0, maxMinutes: 30 };
    const deck = filterDeck(BUILTIN_TOPICS, home, 'autumn');
    expect(deck.length).toBeGreaterThan(5);
    for (const t of deck) {
      expect(['home', 'any']).toContain(t.place);
      expect(t.budget).toBe(0);
      expect(t.minutes).toBeLessThanOrEqual(30);
    }
  });

  it('weighted draw respects exclude and returns null when empty', () => {
    const items = [
      { id: 'a', weight: 1 },
      { id: 'b', weight: 1 },
    ];
    for (let i = 0; i < 20; i++) expect(drawWeighted(items, ['a'], seeded(i))).toBe('b');
    expect(drawWeighted(items, ['a', 'b'])).toBeNull();
  });

  it('one-time cards come up at the chosen share', () => {
    for (const [normal, once, share] of [
      [54, 2, 0.5],
      [30, 1, 0.3],
      [10, 3, 0.7],
    ] as const) {
      const w = onceWeight(normal, once, share);
      const items = [
        ...Array.from({ length: normal }, (_, i) => ({ id: `n${i}`, weight: 1 })),
        ...Array.from({ length: once }, (_, i) => ({ id: `o${i}`, weight: w })),
      ];
      const rng = seeded(7);
      let hits = 0;
      const N = 20000;
      for (let i = 0; i < N; i++) if (drawWeighted(items, [], rng)!.startsWith('o')) hits++;
      expect(Math.abs(hits / N - share)).toBeLessThan(0.015);
    }
  });

  it('computes chances and edge cases', () => {
    expect(onceChance(30, 2, 0.5)).toBe(0.5);
    expect(onceChance(30, 0, 0.5)).toBe(0);
    expect(onceChance(0, 2, 0.5)).toBe(1);
    expect(onceWeight(0, 2, 0.5)).toBe(1);
    expect(onceWeight(10, 0, 0.5)).toBe(0);
  });
});

describe('ふたりで選ぶ', () => {
  it('draws n distinct cards and stops when the pool runs out', () => {
    const items = Array.from({ length: 8 }, (_, i) => ({ id: `t${i}`, weight: 1 }));
    const five = drawManyWeighted(items, 5, ['t0'], seeded(3));
    expect(five).toHaveLength(5);
    expect(new Set(five).size).toBe(5);
    expect(five).not.toContain('t0');
    expect(drawManyWeighted(items, 20)).toHaveLength(8);
  });

  it('finds cards both said yes to', () => {
    const ids = ['a', 'b', 'c', 'd'];
    const r = matchVotes(ids, { a: 'yes', b: 'yes', c: 'no', d: 'no' }, { a: 'no', b: 'yes', c: 'yes', d: 'no' });
    expect(r.both).toEqual(['b']);
    expect(r.either).toEqual(['a', 'b', 'c']);
  });
});

describe('同期', () => {
  const mem = (id: string, extra: Partial<import('./types').Memory> = {}) => ({
    id,
    topicId: 'b001',
    topicText: 't',
    category: 'c',
    date: '2026-10-06',
    done: false,
    notes: ['', ''] as [string, string],
    photoIds: [] as string[],
    ...extra,
  });

  it('stable stringify ignores key order', () => {
    expect(stable({ b: 1, a: [1, { d: 2, c: 3 }] })).toBe(stable({ a: [1, { c: 3, d: 2 }], b: 1 }));
  });

  it('diffs memories against what was last synced', () => {
    const prev = new Map([
      ['m1', stable(mem('m1'))],
      ['m2', stable(mem('m2'))],
    ]);
    const { upserts, removes } = diffMemories(prev, [mem('m1'), mem('m2', { done: true }), mem('m3')]);
    expect(upserts.map((m) => m.id)).toEqual(['m2', 'm3']);
    expect(removes).toEqual([]);
    expect(diffMemories(prev, [mem('m1')]).removes).toEqual(['m2']);
  });

  it('merges both phones without losing notes or photos', () => {
    const merged = mergeMemories(
      [mem('m1', { notes: ['楽しかった', ''], photoIds: ['p1'] })],
      [mem('m1', { done: true, notes: ['', 'また行きたい'], photoIds: ['p2'] }), mem('m2')],
    );
    expect(merged).toHaveLength(2);
    const m1 = merged.find((m) => m.id === 'm1')!;
    expect(m1.done).toBe(true);
    expect(m1.notes).toEqual(['楽しかった', 'また行きたい']);
    expect(m1.photoIds).toEqual(['p1', 'p2']);
  });

  it('reads invite codes from links and plain codes', () => {
    const code = makeRoomId();
    expect(code).toHaveLength(24);
    expect(parseInvite(`https://example.github.io/futari/?join=${code}`)).toBe(code);
    expect(parseInvite(`  ${code} `)).toBe(code);
    expect(parseInvite('hello')).toBeNull();
  });
});

describe('AIでまとめて追加', () => {
  const existing = BUILTIN_TOPICS.slice(0, 50);

  it('builds a prompt that lists existing topics and the format', () => {
    const p = buildPrompt({ existing, categories: CATEGORIES, count: 20, theme: '雨の日' });
    expect(p).toContain('お題を 20 個');
    expect(p).toContain('雨の日');
    expect(p).toContain('カテゴリ|お題|場所|予算|時間|時間帯|季節');
    expect(p).toContain(existing[10].text);
  });

  it('parses well-formed and messy lines', () => {
    const out = parseOutput(
      [
        '```',
        'カテゴリ|お題|場所|予算|時間|時間帯|季節',
        '1. カフェ・スイーツ｜ドトールでミラノサンドを半分こする｜近所｜2,000円｜30分｜昼｜いつでも',
        '- 遊び・アミューズメント | 屋内プールで泳ぐ | おでかけ | なし | 半日 | いつでも | 夏',
        'はい、作りました！',
        '```',
      ].join('\n'),
    );
    expect(out.drafts).toHaveLength(2);
    expect(out.skipped).toContain('はい、作りました！');
    // 区切りなしで本文だけ並んでいるときは、1行ずつお題として読む
    const plain = parseOutput('雨の日に、家で手作りピザを焼く\n近所の銭湯でサウナに入る');
    expect(plain.drafts.map((d) => d.text)).toEqual(['雨の日に、家で手作りピザを焼く', '近所の銭湯でサウナに入る']);
    expect(out.drafts[0]).toMatchObject({ category: 'カフェ・スイーツ', place: 'near', budget: 2000, minutes: 30, timeOfDay: 'day' });
    expect(out.drafts[1]).toMatchObject({ place: 'out', budget: null, minutes: 240, season: 'summer' });
    expect(plain.drafts[0]).toMatchObject({ category: 'AIのお題' });
  });

  it('flags same and similar topics, and duplicates within the answer', () => {
    const base = ['コメダ珈琲でシロノワールを半分こする', '公園でピクニックをする'];
    const drafts = parseOutput(
      [
        'カフェ|コメダ珈琲で、シロノワールを半分こする|近所|2000|120|いつでも|いつでも',
        'カフェ|コメダ珈琲でシロノワールを半分こして食べる|近所|2000|120|いつでも|いつでも',
        '遊び|水族館でペンギンの写真を撮り合う|おでかけ|5000|240|昼|いつでも',
        '遊び|水族館でペンギンの写真を撮り合う|おでかけ|5000|240|昼|いつでも',
      ].join('\n'),
    ).drafts;
    const r = checkDrafts(drafts, base);
    expect(r.map((x) => x.status)).toEqual(['same', 'similar', 'new', 'same']);
  });
});
