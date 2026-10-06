// アプリ全体で使う型

export type Place = 'home' | 'near' | 'out' | 'any';
export type Budget = 0 | 2000 | 5000 | 10000 | null; // ふたり合計の上限。null = 上限なし（1万円より上）
export type Minutes = 30 | 120 | 240 | 480;
export type TimeOfDay = 'day' | 'night' | 'any';
export type Season = 'spring' | 'summer' | 'autumn' | 'winter' | 'any';

export type Topic = {
  id: string;
  text: string;
  category: string;
  place: Place;
  budget: Budget;
  minutes: Minutes;
  timeOfDay: TimeOfDay;
  season: Season;
  source: 'builtin' | 'custom' | 'once'; // once = 今回だけのお題
};

/** ゲーム開始前に選ぶ条件 */
export type Filter = {
  places: Exclude<Place, 'any'>[]; // 空 = すべて
  maxBudget: Budget; // null = 上限なし
  maxMinutes: Minutes;
  timeOfDay: TimeOfDay; // 'any' = 問わない
};

export type Player = 0 | 1;

/** 今回だけのお題のどれかが出る確率（%、10〜90） */
export type OnceShare = number;

/** 季節: auto = 端末の日付から自動で判定 */
export type SeasonMode = 'auto' | Exclude<Season, 'any'>;

export type Settings = {
  names: [string, string];
  anniversary: string | null; // YYYY-MM-DD
  veto: boolean; // 拒否権（ひとり1回の引き直し）
  onceShare: OnceShare;
  seasonMode: SeasonMode;
  hideVotes: boolean; // ふたりで選ぶ: 相手の「あり／なし」を見せない
  includeDone: boolean; // 「やった！」にしたお題も候補に入れる
};

/** ユーザーごとに保存するお題の状態 */
export type TopicPrefs = {
  disabled: string[]; // OFF にした内蔵お題の id
  custom: Topic[]; // 設定から追加したお題（ずっと使う）
  once: Topic[]; // 今回だけのお題（出やすい。引いて決まったら消える）
};

export type Memory = {
  id: string;
  topicId: string;
  topicText: string; // あとでお題を消しても残るようにコピー
  category: string;
  date: string; // YYYY-MM-DD
  done: boolean;
  notes: [string, string];
  photoIds: string[]; // IndexedDB のキー
};
