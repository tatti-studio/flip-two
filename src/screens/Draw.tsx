import { useEffect, useMemo, useRef, useState } from 'react';
import { drawWeighted, onceWeight } from '../lib/deck';
import type { Player, Settings, Topic } from '../lib/types';
import { PlayerDot, TopBar } from '../ui/common';
import { FlipCard, Shuffle, buzz, prefersReducedMotion } from '../ui/motion';

type Phase = 'shuffle' | 'flip' | 'shown' | 'leaving' | 'stamped';

/** シャッフル → めくる → 決定 or 拒否権で引き直し */
export function Draw(props: {
  deck: Topic[]; // 条件に合う通常のお題
  once: Topic[]; // 今回だけのお題（出る確率 settings.onceShare%）
  settings: Settings;
  onBack: () => void;
  onDecide: (t: Topic) => void;
}) {
  const { settings } = props;
  const reduced = useMemo(prefersReducedMotion, []);
  const items = useMemo(() => {
    const w = onceWeight(props.deck.length, props.once.length, settings.onceShare / 100);
    return [...props.deck.map((t) => ({ id: t.id, weight: 1 })), ...props.once.map((t) => ({ id: t.id, weight: w }))];
  }, [props.deck, props.once, settings.onceShare]);
  const byId = useMemo(() => new Map([...props.deck, ...props.once].map((t) => [t.id, t])), [props.deck, props.once]);

  const [seen, setSeen] = useState<string[]>(() => {
    const id = drawWeighted(items);
    return id ? [id] : [];
  });
  const [phase, setPhase] = useState<Phase>(reduced ? 'shown' : 'shuffle');
  const [flipped, setFlipped] = useState(reduced);
  const [vetoUsed, setVetoUsed] = useState<[boolean, boolean]>([false, false]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, reduced ? 0 : ms));
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // シャッフル → めくる
  useEffect(() => {
    if (phase === 'shuffle') later(950, () => setPhase('flip'));
    if (phase === 'flip') {
      setFlipped(false);
      later(80, () => {
        setFlipped(true);
        buzz(10);
      });
      later(760, () => setPhase('shown'));
    }
  }, [phase]);

  const current = seen.length > 0 ? byId.get(seen[seen.length - 1]) ?? null : null;
  const canRedraw = seen.length < items.length;

  const veto = (p: Player) => {
    const id = drawWeighted(items, seen);
    if (!id) return;
    const v: [boolean, boolean] = [...vetoUsed];
    v[p] = true;
    setVetoUsed(v);
    setPhase('leaving');
    later(380, () => {
      setSeen((s) => [...s, id]);
      setPhase('flip');
    });
  };

  const decide = () => {
    if (!current) return;
    setPhase('stamped');
    buzz([15, 60, 25]);
    later(900, () => props.onDecide(current));
  };

  const busy = phase !== 'shown';

  return (
    <div className="screen draw">
      <TopBar title="今日のお題" onBack={props.onBack} />
      {!current ? (
        <p className="lead">引けるお題がありません。条件をゆるめるか、今回だけのお題を追加してください。</p>
      ) : (
        <>
          <div className="draw__stage">
            {phase === 'shuffle' ? (
              <Shuffle />
            ) : (
              <FlipCard
                key={current.id}
                topic={current}
                flipped={flipped}
                leaving={phase === 'leaving'}
                stamped={phase === 'stamped'}
              />
            )}
          </div>
          <p className={`draw__hint ${phase === 'shuffle' ? '' : 'is-hidden'}`} aria-live="polite">
            {phase === 'shuffle' ? 'シャッフル中…' : ''}
          </p>
          <div className={`draw__controls ${busy ? 'is-busy' : ''}`}>
            <button type="button" className="btn btn--primary btn--big" disabled={busy} onClick={decide}>
              これに決定！
            </button>
            {settings.veto && (
              <div className="veto">
                <p className="veto__title">拒否権（ひとり1回・引き直し）</p>
                <div className="veto__row">
                  {([0, 1] as Player[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`btn btn--veto ${p === 0 ? 'owner-a' : 'owner-b'}`}
                      disabled={busy || vetoUsed[p] || !canRedraw}
                      onClick={() => veto(p)}
                    >
                      <PlayerDot player={p} />
                      {vetoUsed[p] ? `${settings.names[p]}は使用済み` : `${settings.names[p]}が使う`}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
