import { useState } from 'react';
import { onceChance, seasonOf } from '../lib/deck';
import { daysSince, newId, today } from '../lib/storage';
import type { Budget, Filter, Memory, Minutes, SeasonMode, Settings, Topic } from '../lib/types';
import type { SyncStatus } from '../sync/types';
import { Chips } from '../ui/common';
import { MINUTES_LABEL, budgetLabel } from '../ui/labels';
import { CardArt } from '../ui/motion';

export const SEASON_LABEL = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' } as const;
type SeasonName = keyof typeof SEASON_LABEL;

function filterSummary(f: Filter): string[] {
  const places =
    f.places.length === 0 ? 'どこでも' : f.places.map((p) => ({ home: 'おうち', near: '近所', out: 'おでかけ' })[p]).join('・');
  const budget = f.maxBudget === null ? '予算なし' : budgetLabel(f.maxBudget);
  const out = [places, budget, MINUTES_LABEL[f.maxMinutes]];
  if (f.timeOfDay !== 'any') out.push(f.timeOfDay === 'day' ? '昼' : '夜');
  return out;
}

export function Home(props: {
  settings: Settings;
  onSettings: (s: Settings) => void;
  memories: Memory[];
  filter: Filter;
  onFilter: (f: Filter) => void;
  deckCount: number;
  doneCount: number;
  season: SeasonName;
  once: Topic[];
  onOnce: (once: Topic[]) => void;
  onDraw: () => void;
  onPair: () => void;
  syncStatus?: SyncStatus;
  onGo: (s: 'album' | 'settings') => void;
}) {
  const { settings, memories, filter: f, onFilter } = props;
  const [openFilter, setOpenFilter] = useState(false);
  const [onceText, setOnceText] = useState('');
  const day = settings.anniversary ? daysSince(settings.anniversary, today()) : null;
  const todo = memories.filter((m) => !m.done).length;
  const total = props.deckCount + props.once.length;
  const chance = onceChance(props.deckCount, props.once.length, settings.onceShare / 100);
  const autoSeason = seasonOf(new Date());

  const togglePlace = (p: 'home' | 'near' | 'out') =>
    onFilter({ ...f, places: f.places.includes(p) ? f.places.filter((x) => x !== p) : [...f.places, p] });

  const addOnce = () => {
    const text = onceText.trim();
    if (!text) return;
    const t: Topic = {
      id: newId('o'),
      text,
      category: '今回だけ',
      place: 'any',
      budget: null,
      minutes: 480,
      timeOfDay: 'any',
      season: 'any',
      source: 'once',
    };
    props.onOnce([...props.once, t]);
    setOnceText('');
  };

  return (
    <div className="screen">
      <header className="hero">
        <p className="hero__pair">
          <span className="owner-a-text">{settings.names[0]}</span>
          <span className="hero__amp">と</span>
          <span className="owner-b-text">{settings.names[1]}</span>
          {props.syncStatus && props.syncStatus !== 'off' && (
            <span className={`sync-status sync-status--${props.syncStatus}`}>
              {props.syncStatus === 'synced' ? '同期中' : props.syncStatus === 'offline' ? 'オフライン' : props.syncStatus === 'connecting' ? 'つないでいます' : '同期エラー'}
            </span>
          )}
        </p>
        <h1 className="logo">
          Flip Two
          <span className="logo__sub">次、なにする？</span>
        </h1>
        {day !== null && day > 0 && (
          <p className="days">
            付き合って<span className="days__num">{day.toLocaleString('ja-JP')}</span>日目
          </p>
        )}
      </header>

      <section className="deck-area" aria-label="カードを引く">
        <button type="button" className="deck" onClick={props.onPair} disabled={total < 2} aria-label="ふたりで選ぶ">
          <span className="deck__layer deck__layer--3">
            <CardArt />
          </span>
          <span className="deck__layer deck__layer--2">
            <CardArt />
          </span>
          <span className="deck__layer deck__layer--1">
            <CardArt />
          </span>
          <span className="deck__count">{total}枚</span>
        </button>
        {total < 2 ? (
          <p className="deck__cta">候補が足りません。条件をゆるめてね</p>
        ) : (
          <>
            <p className="deck__cta">タップして、ふたりで選ぶ</p>
            <p className="deck__sub">5枚にそれぞれ「あり／なし」→ ふたりとも「あり」から決定</p>
            <button type="button" className="btn btn--ghost btn--small" onClick={props.onDraw}>
              おまかせで1枚めくる
            </button>
          </>
        )}
        <div className="quick" role="group" aria-label="よく変えるルール">
          <QuickToggle
            label="拒否権"
            on={settings.veto}
            hint="おまかせで、ひとり1回引き直せる"
            onChange={(v) => props.onSettings({ ...settings, veto: v })}
          />
          <QuickToggle
            label="相手の答えを隠す"
            on={settings.hideVotes}
            hint="ふたりで選ぶで、誰が「あり」にしたか見せない"
            onChange={(v) => props.onSettings({ ...settings, hideVotes: v })}
          />
          <QuickToggle
            label="やったお題も出す"
            on={settings.includeDone}
            hint={props.doneCount > 0 ? `オフの今は、やったお題${props.doneCount}枚を外しています` : '「やった！」にしたお題を候補に入れる'}
            onChange={(v) => props.onSettings({ ...settings, includeDone: v })}
          />
        </div>
      </section>

      <section className="panel">
        <button type="button" className="disclosure" aria-expanded={openFilter} onClick={() => setOpenFilter(!openFilter)}>
          <span className="disclosure__body">
            <span className="label">条件</span>
            <span className="pills">
              {filterSummary(f).map((s) => (
                <span key={s} className="pill">
                  {s}
                </span>
              ))}
              <span className="pill pill--season">{SEASON_LABEL[props.season]}</span>
            </span>
          </span>
          <span className="disclosure__action">{openFilter ? '閉じる' : '変える'}</span>
        </button>
        {openFilter && (
          <div className="stack reveal">
            <h2 className="label">場所（複数選べる・選ばなければ全部）</h2>
            <Chips
              name="場所"
              value={f.places}
              onChange={(v) => togglePlace(v)}
              options={[
                { value: 'home', label: 'おうち' },
                { value: 'near', label: '近所' },
                { value: 'out', label: 'おでかけ' },
              ]}
            />
            <h2 className="label">予算（ふたり合計）</h2>
            <Chips<Budget>
              name="予算"
              value={f.maxBudget}
              onChange={(v) => onFilter({ ...f, maxBudget: v })}
              options={[
                { value: 0, label: '0円' },
                { value: 2000, label: '〜2,000円' },
                { value: 5000, label: '〜5,000円' },
                { value: 10000, label: '〜1万円' },
                { value: null, label: '上限なし' },
              ]}
            />
            <h2 className="label">使える時間</h2>
            <Chips<Minutes>
              name="時間"
              value={f.maxMinutes}
              onChange={(v) => onFilter({ ...f, maxMinutes: v })}
              options={[
                { value: 30, label: '〜30分' },
                { value: 120, label: '〜2時間' },
                { value: 240, label: '半日' },
                { value: 480, label: '1日' },
              ]}
            />
            <h2 className="label">時間帯</h2>
            <Chips
              name="時間帯"
              value={f.timeOfDay}
              onChange={(v) => onFilter({ ...f, timeOfDay: v })}
              options={[
                { value: 'any', label: '問わない' },
                { value: 'day', label: '昼' },
                { value: 'night', label: '夜' },
              ]}
            />
            <h2 className="label">季節（季節もののお題に使う）</h2>
            <Chips<SeasonMode>
              name="季節"
              value={settings.seasonMode}
              onChange={(v) => props.onSettings({ ...settings, seasonMode: v })}
              options={[
                { value: 'auto', label: `自動（${SEASON_LABEL[autoSeason]}）` },
                { value: 'spring', label: '春' },
                { value: 'summer', label: '夏' },
                { value: 'autumn', label: '秋' },
                { value: 'winter', label: '冬' },
              ]}
            />
            <p className="muted">
              「自動」は今日の日付（{new Date().getMonth() + 1}月）から季節を決めます。3〜5月は春、6〜8月は夏、9〜11月は秋、12〜2月は冬。
            </p>
          </div>
        )}
      </section>

      <section className="panel stack once">
        <div className="once__head">
          <h2 className="label">今回だけのお題</h2>
          <p className="muted">その日だけ入れたいお題。決まったら消えます。条件の絞り込みは受けません。</p>
        </div>
        {props.once.length > 0 && (
          <ul className="once-list">
            {props.once.map((t) => (
              <li key={t.id} className="once-list__item">
                <span className="once-list__text">{t.text}</span>
                <button
                  type="button"
                  className="once-list__remove"
                  aria-label={`「${t.text}」を外す`}
                  onClick={() => props.onOnce(props.once.filter((x) => x.id !== t.id))}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="once-form"
          onSubmit={(e) => {
            e.preventDefault();
            addOnce();
          }}
        >
          <input
            id="once-text"
            value={onceText}
            maxLength={80}
            placeholder="例: 帰りに駅前のたい焼きを買う"
            onChange={(e) => setOnceText(e.target.value)}
          />
          <button type="submit" className="btn btn--primary btn--small" disabled={!onceText.trim()}>
            追加
          </button>
        </form>

        <div className="odds">
          <div className="odds__head">
            <label htmlFor="once-share" className="odds__label">
              今回だけのお題が出る確率
            </label>
            <span className="odds__value">{settings.onceShare}%</span>
          </div>
          <input
            id="once-share"
            className="slider"
            type="range"
            min={10}
            max={90}
            step={10}
            value={settings.onceShare}
            style={{ ['--fill' as string]: `${((settings.onceShare - 10) / 80) * 100}%` }}
            onChange={(e) => props.onSettings({ ...settings, onceShare: Number(e.target.value) })}
          />
          <div className="odds__bar" aria-hidden="true">
            <span className="odds__once" style={{ width: `${Math.round(chance * 100)}%` }} />
          </div>
          <p className="muted">
            {props.once.length === 0
              ? 'お題を追加すると、この確率で出ます'
              : chance >= 1
                ? '通常のお題が0枚なので、今回だけのお題から必ず出ます'
                : `今回だけ ${props.once.length}枚で ${Math.round(chance * 100)}%、通常のお題 ${props.deckCount}枚で ${100 - Math.round(chance * 100)}%`}
          </p>
        </div>
      </section>

      <nav className="menu">
        <button type="button" className="menu__item" onClick={() => props.onGo('album')}>
          <span>ふたりのアルバム</span>
          <span className="menu__meta">{memories.length > 0 ? `${memories.length}件・まだ ${todo}` : 'まだなし'} →</span>
        </button>
        <button type="button" className="menu__item" onClick={() => props.onGo('settings')}>
          <span>設定・お題の追加</span>
          <span className="menu__meta">→</span>
        </button>
      </nav>
    </div>
  );
}

/** めくる場所のすぐ下に置く、ワンタップで切り替えるルール */
function QuickToggle(props: { label: string; on: boolean; hint: string; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      className={`quick__item ${props.on ? 'is-on' : ''}`}
      role="switch"
      aria-checked={props.on}
      title={props.hint}
      onClick={() => props.onChange(!props.on)}
    >
      <span className="quick__state" aria-hidden="true">
        {props.on ? 'ON' : 'OFF'}
      </span>
      <span className="quick__label">{props.label}</span>
    </button>
  );
}
