import { useEffect, useMemo, useState } from 'react';
import { CATEGORIES } from '../data/topics';
import { daysSince, deletePhoto, getPhoto, newId, putPhoto, shrinkImage } from '../lib/storage';
import type { Budget, Memory, Minutes, Place, Player, Settings, TimeOfDay, Topic, TopicPrefs } from '../lib/types';
import { Chips, ConfirmButton, DateDigits, PlayerDot, TopBar, TopicCard } from '../ui/common';
import { Confetti, buzz } from '../ui/motion';
import { formatDate } from '../ui/labels';

// ---------------- はじめに ----------------

export function Welcome(props: { onDone: (names: [string, string], anniversary: string | null) => void }) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [ann, setAnn] = useState('');
  return (
    <div className="screen">
      <div className="hero">
        <p className="hero__eyebrow">ふたりの「次なにする？」を決めるカード</p>
        <h1 className="logo">
          Flip Two
          <span className="logo__sub">次、なにする？</span>
        </h1>
      </div>
      <form
        className="panel stack"
        onSubmit={(e) => {
          e.preventDefault();
          props.onDone([a.trim() || 'ひとりめ', b.trim() || 'ふたりめ'], ann || null);
        }}
      >
        <label className="field">
          <span className="field__label">
            <PlayerDot player={0} />
            ひとりめの名前
          </span>
          <input id="name-a" value={a} maxLength={10} placeholder="例: なまえ1" onChange={(e) => setA(e.target.value)} />
        </label>
        <label className="field">
          <span className="field__label">
            <PlayerDot player={1} />
            ふたりめの名前
          </span>
          <input id="name-b" value={b} maxLength={10} placeholder="例: なまえ2" onChange={(e) => setB(e.target.value)} />
        </label>
        <label className="field">
          <span className="field__label">付き合った日（数字8桁で。あとで設定でもOK）</span>
          <DateDigits id="anniversary" value={ann || null} onChange={(v) => setAnn(v ?? '')} />
        </label>
        <div className="actions">
          <button type="submit" className="btn btn--primary">
            はじめる
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------------- アルバム ----------------

function Photo({ id, onClick }: { id: string; onClick?: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    let made: string | null = null;
    getPhoto(id).then((b) => {
      if (!alive || !b) return;
      made = URL.createObjectURL(b);
      setUrl(made);
    });
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [id]);
  if (!url) return <div className="photo photo--empty" />;
  return onClick ? (
    <button type="button" className="photo" onClick={onClick}>
      <img src={url} alt="" />
    </button>
  ) : (
    <div className="photo">
      <img src={url} alt="" />
    </div>
  );
}

export function Album(props: {
  memories: Memory[];
  settings: Settings;
  onOpen: (id: string) => void;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<'all' | 'todo' | 'done'>('all');
  const list = props.memories
    .filter((m) => (tab === 'all' ? true : tab === 'todo' ? !m.done : m.done))
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return (
    <div className="screen">
      <TopBar title="ふたりのアルバム" onBack={props.onBack} />
      <Chips
        name="表示"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'all', label: `すべて ${props.memories.length}` },
          { value: 'todo', label: `まだ ${props.memories.filter((m) => !m.done).length}` },
          { value: 'done', label: `やった ${props.memories.filter((m) => m.done).length}` },
        ]}
      />
      {list.length === 0 ? (
        <div className="empty">
          <p className="lead">まだ記録がありません</p>
          <p className="muted">ホームからモードを選んでお題を決めると、ここにたまっていきます。</p>
        </div>
      ) : (
        <ul className="album">
          {list.map((m) => (
            <li key={m.id}>
              <button type="button" className={`album__item ${m.done ? 'is-done' : ''}`} onClick={() => props.onOpen(m.id)}>
                <span className="album__date">
                  {formatDate(m.date)}
                  {props.settings.anniversary && daysSince(props.settings.anniversary, m.date) > 0 && (
                    <span className="album__day"> ・{daysSince(props.settings.anniversary, m.date)}日目</span>
                  )}
                </span>
                <span className="album__text">{m.topicText}</span>
                <span className="album__meta">
                  <span className={`stamp ${m.done ? 'stamp--done' : ''}`}>{m.done ? 'やった！' : 'まだ'}</span>
                  {m.photoIds.length > 0 && <span className="muted">写真 {m.photoIds.length}</span>}
                </span>
                {m.photoIds[0] && (
                  <span className="album__thumb">
                    <Photo id={m.photoIds[0]} />
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function MemoryDetail(props: {
  memory: Memory;
  settings: Settings;
  /** 決定した直後に開いたときは、決定の演出つきで見せる */
  fresh?: Topic;
  onHome?: () => void;
  onChange: (m: Memory) => void;
  onDelete: () => void;
  onBack: () => void;
}) {
  const { memory: m, settings } = props;
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const addPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    const ids: string[] = [];
    for (const f of Array.from(files).slice(0, 10)) {
      const id = newId('p');
      await putPhoto(id, await shrinkImage(f));
      ids.push(id);
    }
    props.onChange({ ...m, photoIds: [...m.photoIds, ...ids] });
    setBusy(false);
  };
  return (
    <div className={`screen ${props.fresh ? 'result' : ''}`}>
      {props.fresh && <Confetti burst={1} />}
      <TopBar title={props.fresh ? '今日のお題' : '思い出'} onBack={props.onBack} />
      <p className="muted">
        {formatDate(m.date)}に決定
        {settings.anniversary && daysSince(settings.anniversary, m.date) > 0 && `・付き合って${daysSince(settings.anniversary, m.date)}日目`}
      </p>
      {props.fresh ? (
        <div className="result-card">
          <TopicCard topic={props.fresh} big />
          <span className="stamp-big stamp-big--rest" aria-hidden="true">
            決定！
          </span>
        </div>
      ) : (
        <div className="memory-text">
          <span className="ticket__cat">{m.category}</span>
          <p>{m.topicText}</p>
        </div>
      )}
      {props.fresh && !m.done && (
        <p className="next-step">さっそくやってみよう。終わったら「やった！」をタップして、写真やひとことを残してね。</p>
      )}
      <button
        type="button"
        className={`done-toggle ${m.done ? 'is-done' : ''}`}
        aria-pressed={m.done}
        onClick={() => {
          if (!m.done) buzz([10, 40, 10]);
          props.onChange({ ...m, done: !m.done });
        }}
      >
        {m.done ? 'やった！' : 'まだ（やったらタップ）'}
      </button>

      <section className="panel stack">
        <h2 className="label">写真</h2>
        <div className="photos">
          {m.photoIds.map((id) => (
            <Photo key={id} id={id} onClick={() => setViewing(id)} />
          ))}
          <label className="photo photo--add">
            <input
              id={`photo-${m.id}`}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                void addPhotos(e.target.files);
                e.target.value = '';
              }}
            />
            <span>{busy ? '保存中…' : '＋ 追加'}</span>
          </label>
        </div>
        {viewing && (
          <div className="viewer">
            <Photo id={viewing} />
            <div className="veto__row">
              <ConfirmButton
                label="この写真を削除"
                confirmLabel="削除する"
                onConfirm={() => {
                  void deletePhoto(viewing);
                  props.onChange({ ...m, photoIds: m.photoIds.filter((p) => p !== viewing) });
                  setViewing(null);
                }}
              />
              <button type="button" className="btn btn--ghost" onClick={() => setViewing(null)}>
                閉じる
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="panel stack">
        <h2 className="label">ひとこと</h2>
        {([0, 1] as Player[]).map((p) => (
          <label key={p} className="field">
            <span className="field__label">
              <PlayerDot player={p} />
              {settings.names[p]}
            </span>
            <textarea
              id={`note-${m.id}-${p}`}
              rows={2}
              value={m.notes[p]}
              placeholder="どうだった？"
              onChange={(e) => {
                const notes: [string, string] = [...m.notes];
                notes[p] = e.target.value;
                props.onChange({ ...m, notes });
              }}
            />
          </label>
        ))}
      </section>

      <div className="actions">
        {props.onHome && (
          <button type="button" className="btn btn--primary" onClick={props.onHome}>
            ホームへ
          </button>
        )}
        <ConfirmButton label="この記録を削除" confirmLabel="削除する" onConfirm={props.onDelete} />
      </div>
    </div>
  );
}

// ---------------- お題を追加するフォーム（設定の中） ----------------

const EMPTY_DRAFT = {
  text: '',
  category: CATEGORIES[0],
  place: 'any' as Place,
  budget: 0 as Budget,
  minutes: 120 as Minutes,
  timeOfDay: 'any' as TimeOfDay,
};

function AddTopicForm(props: { onAdd: (t: Topic) => void }) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [added, setAdded] = useState<string | null>(null);
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (!draft.text.trim()) return;
        props.onAdd({ id: newId('c'), ...draft, text: draft.text.trim(), season: 'any', source: 'custom' });
        setAdded(draft.text.trim());
        setDraft({ ...EMPTY_DRAFT, category: draft.category });
      }}
    >
      <label className="field">
        <span className="field__label">お題（店・金額・やり方まで書くと楽しい）</span>
        <textarea
          id="new-topic-text"
          rows={2}
          maxLength={80}
          value={draft.text}
          placeholder="例: 駅前のパン屋で、相手が好きそうなパンを1つずつ選ぶ"
          onChange={(e) => {
            setDraft({ ...draft, text: e.target.value });
            setAdded(null);
          }}
        />
      </label>
      <label className="field">
        <span className="field__label">カテゴリ</span>
        <select id="new-topic-cat" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <span className="field__label">場所</span>
      <Chips<Place>
        name="場所"
        value={draft.place}
        onChange={(v) => setDraft({ ...draft, place: v })}
        options={[
          { value: 'home', label: 'おうち' },
          { value: 'near', label: '近所' },
          { value: 'out', label: 'おでかけ' },
          { value: 'any', label: 'どこでも' },
        ]}
      />
      <span className="field__label">予算（ふたり合計）</span>
      <Chips<Budget>
        name="予算"
        value={draft.budget}
        onChange={(v) => setDraft({ ...draft, budget: v })}
        options={[
          { value: 0, label: '0円' },
          { value: 2000, label: '〜2,000円' },
          { value: 5000, label: '〜5,000円' },
          { value: 10000, label: '〜1万円' },
          { value: null, label: 'それ以上' },
        ]}
      />
      <span className="field__label">時間</span>
      <Chips<Minutes>
        name="時間"
        value={draft.minutes}
        onChange={(v) => setDraft({ ...draft, minutes: v })}
        options={[
          { value: 30, label: '〜30分' },
          { value: 120, label: '〜2時間' },
          { value: 240, label: '半日' },
          { value: 480, label: '1日' },
        ]}
      />
      <span className="field__label">時間帯</span>
      <Chips<TimeOfDay>
        name="時間帯"
        value={draft.timeOfDay}
        onChange={(v) => setDraft({ ...draft, timeOfDay: v })}
        options={[
          { value: 'any', label: 'いつでも' },
          { value: 'day', label: '昼' },
          { value: 'night', label: '夜' },
        ]}
      />
      <div className="actions">
        <button type="submit" className="btn btn--primary" disabled={!draft.text.trim()}>
          お題を追加する
        </button>
      </div>
      {added && (
        <p className="toast" role="status">
          「{added}」を追加しました
        </p>
      )}
    </form>
  );
}

// ---------------- お題一覧（設定 → お題一覧） ----------------

export function TopicManager(props: {
  all: Topic[];
  prefs: TopicPrefs;
  onPrefs: (p: TopicPrefs) => void;
  onBack: () => void;
}) {
  const { prefs } = props;
  const [cat, setCat] = useState<string>('すべて');
  const cats = useMemo(() => {
    const own = prefs.custom.length > 0 ? ['ふたりのお題'] : [];
    return ['すべて', ...own, ...CATEGORIES];
  }, [prefs.custom.length]);
  const list = props.all.filter((t) =>
    cat === 'すべて' ? true : cat === 'ふたりのお題' ? t.source === 'custom' : t.category === cat,
  );
  const enabledCount = props.all.filter((t) => !prefs.disabled.includes(t.id)).length;
  const toggle = (id: string) =>
    props.onPrefs({
      ...prefs,
      disabled: prefs.disabled.includes(id) ? prefs.disabled.filter((x) => x !== id) : [...prefs.disabled, id],
    });

  return (
    <div className="screen">
      <TopBar title="お題一覧" onBack={props.onBack} />
      <p className="muted">
        使うお題 {enabledCount} / {props.all.length}。OFF にしたお題は引かれません。
      </p>
      <div className="scroll-x">
        <Chips name="カテゴリ" value={cat} onChange={setCat} options={cats.map((c) => ({ value: c, label: c }))} />
      </div>
      <ul className="topic-list">
        {list.map((t) => {
          const off = prefs.disabled.includes(t.id);
          return (
            <li key={t.id}>
              <TopicCard
                topic={t}
                dim={off}
                footer={
                  <div className="topic-list__ctl">
                    {t.source === 'custom' && (
                      <ConfirmButton
                        className="btn btn--ghost btn--small"
                        label="削除"
                        confirmLabel="削除する"
                        onConfirm={() =>
                          props.onPrefs({
                            ...prefs,
                            custom: prefs.custom.filter((c) => c.id !== t.id),
                            disabled: prefs.disabled.filter((x) => x !== t.id),
                          })
                        }
                      />
                    )}
                    <button
                      type="button"
                      className={`switch ${off ? '' : 'is-on'}`}
                      role="switch"
                      aria-checked={!off}
                      aria-label={`${t.text} を使う`}
                      onClick={() => toggle(t.id)}
                    >
                      {off ? 'OFF' : 'ON'}
                    </button>
                  </div>
                }
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------------- 設定 ----------------

export function SettingsPage(props: {
  settings: Settings;
  prefs: TopicPrefs;
  totalTopics: number;
  onChange: (s: Settings) => void;
  onPrefs: (p: TopicPrefs) => void;
  onManageTopics: () => void;
  onAiAdd: () => void;
  syncSection?: React.ReactNode;
  backupSection?: React.ReactNode;
  onResetAll: () => void;
  onBack: () => void;
}) {
  const s = props.settings;
  return (
    <div className="screen">
      <TopBar title="設定" onBack={props.onBack} />
      {props.syncSection}

      <section className="panel stack">
        <h2 className="label">お題を追加（ずっと使う）</h2>
        <p className="muted">ここで追加したお題は、通常のお題と同じ確率で毎回の候補に入ります。その日だけのお題はホームの「今回だけのお題」から。</p>
        <AddTopicForm onAdd={(t) => props.onPrefs({ ...props.prefs, custom: [...props.prefs.custom, t] })} />
        <button type="button" className="menu__item menu__item--inline ai-entry" onClick={props.onAiAdd}>
          <span>
            AIでお題をまとめて追加
            <span className="muted ai-entry__sub">プロンプトをコピー → AIの答えを貼るだけ</span>
          </span>
          <span className="menu__meta">→</span>
        </button>
        <button type="button" className="menu__item menu__item--inline" onClick={props.onManageTopics}>
          <span>お題一覧・ON/OFF</span>
          <span className="menu__meta">{props.totalTopics}枚 →</span>
        </button>
      </section>


      <section className="panel stack">
        <h2 className="label">ふたり</h2>
        {([0, 1] as Player[]).map((p) => (
          <label key={p} className="field">
            <span className="field__label">
              <PlayerDot player={p} />
              {p === 0 ? 'ひとりめ' : 'ふたりめ'}
            </span>
            <input
              id={`setting-name-${p}`}
              value={s.names[p]}
              maxLength={10}
              onChange={(e) => {
                const names: [string, string] = [...s.names];
                names[p] = e.target.value;
                props.onChange({ ...s, names });
              }}
            />
          </label>
        ))}
        <label className="field">
          <span className="field__label">付き合った日（数字8桁で入力）</span>
          <DateDigits id="setting-anniversary" value={s.anniversary} onChange={(v) => props.onChange({ ...s, anniversary: v })} />
        </label>
      </section>

      {props.backupSection}
      <section className="panel stack">
        <h2 className="label">データ</h2>
        <p className="muted">記録や写真は、この端末のブラウザの中だけに保存されます。</p>
        <ConfirmButton label="すべてのデータを消す" confirmLabel="本当に消す" onConfirm={props.onResetAll} />
      </section>
    </div>
  );
}
