import { useEffect, useMemo, useState } from 'react';
import { BUILTIN_TOPICS, CATEGORIES } from './data/topics';
import { filterDeck, seasonOf } from './lib/deck';
import { deletePhoto, load, newId, remove, requestPersist, save, today } from './lib/storage';
import type { Filter, Memory, Settings, Topic, TopicPrefs } from './lib/types';
import { AiAdd } from './screens/AiAdd';
import { Draw } from './screens/Draw';
import { Pair } from './screens/Pair';
import { Home } from './screens/Home';
import { Album, MemoryDetail, SettingsPage, TopicManager, Welcome } from './screens/Pages';
import { BackupSection } from './screens/Backup';
import { InstallHint } from './screens/InstallHint';
import { InviteBanner, SyncPanel } from './screens/SyncPanel';
import { parseInvite } from './sync/engine';
import { useSync } from './sync/useSync';

type Screen =
  | { name: 'welcome' }
  | { name: 'home' }
  | { name: 'draw'; deck: Topic[]; once: Topic[] }
  | { name: 'pair'; deck: Topic[]; once: Topic[] }
  | { name: 'album' }
  | { name: 'memory'; id: string; fresh?: Topic }
  | { name: 'settings' }
  | { name: 'topics' }
  | { name: 'aiAdd' };

const DEFAULT_SETTINGS: Settings = {
  names: ['ひとりめ', 'ふたりめ'],
  anniversary: null,
  veto: true,
  onceShare: 50,
  seasonMode: 'auto',
  hideVotes: false,
  includeDone: false,
};
const DEFAULT_PREFS: TopicPrefs = { disabled: [], custom: [], once: [] };
/** claude.ai の公開ページ（お試し版）として動いているか */
const IS_ARTIFACT = import.meta.env.MODE === 'artifact';
const DEFAULT_FILTER: Filter = { places: [], maxBudget: null, maxMinutes: 480, timeOfDay: 'any' };

export default function App() {
  const [onboarded, setOnboarded] = useState(() => load('onboarded', false));
  const [settings, setSettings] = useState<Settings>(() => ({ ...DEFAULT_SETTINGS, ...load('settings', {}) }));
  const [prefs, setPrefs] = useState<TopicPrefs>(() => ({ ...DEFAULT_PREFS, ...load('prefs', {}) }));
  const [memories, setMemories] = useState<Memory[]>(() => load('memories', []));
  const [filter, setFilter] = useState<Filter>(() => ({ ...DEFAULT_FILTER, ...load('filter', {}) }));
  const [screen, setScreen] = useState<Screen>(() => (onboarded ? { name: 'home' } : { name: 'welcome' }));
  const s = useSync({ settings, setSettings, prefs, setPrefs, memories, setMemories });
  // 招待リンク（?join=コード）から開いたとき
  const [invite, setInvite] = useState<string | null>(() => {
    try {
      const code = parseInvite(location.search);
      if (code) history.replaceState(null, '', location.pathname);
      return code;
    } catch {
      return null;
    }
  });
  useEffect(() => {
    void requestPersist();
  }, []);

  useEffect(() => save('settings', settings), [settings]);
  useEffect(() => save('prefs', prefs), [prefs]);
  useEffect(() => save('memories', memories), [memories]);
  useEffect(() => save('filter', filter), [filter]);
  useEffect(() => remove('active'), []); // 旧版（じっくりモード）の途中データを片付ける
  useEffect(() => {
    try {
      window.scrollTo({ top: 0 });
    } catch {
      /* noop */
    }
  }, [screen.name]);

  const season = settings.seasonMode === 'auto' ? seasonOf(new Date()) : settings.seasonMode;
  const allTopics = useMemo(() => [...BUILTIN_TOPICS, ...prefs.custom], [prefs.custom]);
  // 「やった！」にしたお題は、設定がオフなら候補から外す（ずっと使っても同じお題ばかりにならないように）
  const doneIds = useMemo(() => new Set(memories.filter((m) => m.done).map((m) => m.topicId)), [memories]);
  const usable = useMemo(
    () => allTopics.filter((t) => !prefs.disabled.includes(t.id) && (settings.includeDone || !doneIds.has(t.id))),
    [allTopics, prefs.disabled, settings.includeDone, doneIds],
  );
  const deck = useMemo(() => filterDeck(usable, filter, season), [usable, filter, season]);
  const home = () => setScreen({ name: 'home' });

  const decide = (topic: Topic) => {
    const memory: Memory = {
      id: newId('m'),
      topicId: topic.id,
      topicText: topic.text,
      category: topic.category,
      date: today(),
      done: false,
      notes: ['', ''],
      photoIds: [],
    };
    setMemories((ms) => [memory, ...ms]);
    // 今回だけのお題は、決まったら消える
    if (topic.source === 'once') setPrefs((p) => ({ ...p, once: p.once.filter((t) => t.id !== topic.id) }));
    setScreen({ name: 'memory', id: memory.id, fresh: topic });
  };

  let view: React.ReactNode = null;
  switch (screen.name) {
    case 'welcome':
      view = (
        <Welcome
          onDone={(names, anniversary) => {
            setSettings({ ...settings, names, anniversary });
            setOnboarded(true);
            save('onboarded', true);
            home();
          }}
        />
      );
      break;
    case 'home':
      view = (
        <Home
          settings={settings}
          onSettings={setSettings}
          memories={memories}
          filter={filter}
          onFilter={setFilter}
          deckCount={deck.length}
          doneCount={settings.includeDone ? 0 : doneIds.size}
          season={season}
          once={prefs.once}
          onOnce={(once) => setPrefs({ ...prefs, once })}
          onDraw={() => setScreen({ name: 'draw', deck, once: prefs.once })}
          onPair={() => setScreen({ name: 'pair', deck, once: prefs.once })}
          syncStatus={s.status}
          onGo={(name) => setScreen({ name } as Screen)}
        />
      );
      break;
    case 'pair':
      view = <Pair deck={screen.deck} once={screen.once} settings={settings} onBack={home} onDecide={decide} />;
      break;
    case 'draw':
      view = <Draw deck={screen.deck} once={screen.once} settings={settings} onBack={home} onDecide={decide} />;
      break;
    case 'album':
      view = <Album memories={memories} settings={settings} onOpen={(id) => setScreen({ name: 'memory', id })} onBack={home} />;
      break;
    case 'memory': {
      const memory = memories.find((m) => m.id === screen.id);
      view = memory ? (
        <MemoryDetail
          memory={memory}
          settings={settings}
          fresh={screen.fresh}
          onHome={screen.fresh ? home : undefined}
          onChange={(m) => setMemories((ms) => ms.map((x) => (x.id === m.id ? m : x)))}
          onDelete={() => {
            memory.photoIds.forEach((p) => void deletePhoto(p));
            setMemories((ms) => ms.filter((m) => m.id !== memory.id));
            setScreen({ name: 'album' });
          }}
          onBack={() => (screen.fresh ? home() : setScreen({ name: 'album' }))}
        />
      ) : null;
      break;
    }
    case 'settings':
      view = (
        <SettingsPage
          settings={settings}
          prefs={prefs}
          totalTopics={allTopics.length}
          onChange={setSettings}
          onPrefs={setPrefs}
          onManageTopics={() => setScreen({ name: 'topics' })}
          onAiAdd={() => setScreen({ name: 'aiAdd' })}
          syncSection={<SyncPanel s={s} partnerHint={settings.names[1] || '相手'} />}
          backupSection={
            IS_ARTIFACT ? null : (
              <BackupSection
                settings={settings}
                prefs={prefs}
                memories={memories}
                onRestore={(d) => {
                  setSettings({ ...DEFAULT_SETTINGS, ...d.settings });
                  setPrefs({ ...DEFAULT_PREFS, ...d.prefs });
                  setMemories(d.memories);
                }}
              />
            )
          }
          onResetAll={() => {
            // 同期中なら先に同期をやめる（相手のデータまで消さないため）
            s.leave();
            memories.forEach((m) => m.photoIds.forEach((p) => void deletePhoto(p)));
            setMemories([]);
            setPrefs(DEFAULT_PREFS);
            setSettings(DEFAULT_SETTINGS);
            setFilter(DEFAULT_FILTER);
            setOnboarded(false);
            save('onboarded', false);
            setScreen({ name: 'welcome' });
          }}
          onBack={home}
        />
      );
      break;
    case 'aiAdd':
      view = (
        <AiAdd
          all={allTopics}
          categories={CATEGORIES}
          onAdd={(ts) => setPrefs((p) => ({ ...p, custom: [...p.custom, ...ts] }))}
          onBack={() => setScreen({ name: 'settings' })}
        />
      );
      break;
    case 'topics':
      view = <TopicManager all={allTopics} prefs={prefs} onPrefs={setPrefs} onBack={() => setScreen({ name: 'settings' })} />;
      break;
  }

  const showInvite = invite && invite !== s.room;
  return (
    <main className="app">
      {showInvite && (
        <InviteBanner
          s={s}
          code={invite}
          onDone={() => {
            setInvite(null);
            setOnboarded(true);
            save('onboarded', true);
            home();
          }}
          onDismiss={() => setInvite(null)}
        />
      )}
      {screen.name === 'home' && !IS_ARTIFACT && <InstallHint />}
      {view}
    </main>
  );
}
