import type { Budget, Minutes, Place, TimeOfDay, Topic } from '../lib/types';

export const PLACE_LABEL: Record<Place, string> = { home: 'おうち', near: '近所', out: 'おでかけ', any: 'どこでも' };
export const TIME_OF_DAY_LABEL: Record<TimeOfDay, string> = { day: '昼', night: '夜', any: 'いつでも' };
export const MINUTES_LABEL: Record<Minutes, string> = { 30: '〜30分', 120: '〜2時間', 240: '半日', 480: '1日' };


export function budgetLabel(b: Budget): string {
  if (b === null) return '上限なし';
  if (b === 0) return '0円';
  if (b === 10000) return '〜1万円';
  return `〜${b.toLocaleString('ja-JP')}円`;
}

export function topicTags(t: Topic): string[] {
  const tags = [PLACE_LABEL[t.place], budgetLabel(t.budget), MINUTES_LABEL[t.minutes]];
  if (t.timeOfDay !== 'any') tags.push(TIME_OF_DAY_LABEL[t.timeOfDay]);
  return tags;
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const w = ['日', '月', '火', '水', '木', '金', '土'][new Date(y, m - 1, d).getDay()];
  return `${y}年${m}月${d}日（${w}）`;
}
