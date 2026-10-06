// ふたりで選ぶ: 5枚配る → それぞれこっそり「あり／なし」 → せーので答え合わせ → ふたりとも「あり」から決める
import { useEffect, useMemo, useRef, useState } from 'react';
import { drawManyWeighted, matchVotes, onceWeight, type Vote } from '../lib/deck';
import type { Player, Settings, Topic } from '../lib/types';
import { PlayerDot, TopBar, TopicCard } from '../ui/common';
import { Shuffle, buzz, prefersReducedMotion } from '../ui/motion';

const HAND = 5;

type Step =
  | { kind: 'deal' }
  | { kind: 'handoff'; player: Player }
  | { kind: 'vote'; player: Player }
  | { kind: 'ready' }
  | { kind: 'reveal' }
  | { kind: 'roulette'; pool: string[] }
  | { kind: 'decided'; id: string };

export function Pair(props: {
  deck: Topic[];
  once: Topic[];
  settings: Settings;
  onBack: () => void;
  onDecide: (t: Topic) => void;
}) {
  const { settings } = props;
  const names = settings.names;
  const reduced = useMemo(prefersReducedMotion, []);
  const items = useMemo(() => {
    const w = onceWeight(props.deck.length, props.once.length, settings.onceShare / 100);
    return [...props.deck.map((t) => ({ id: t.id, weight: 1 })), ...props.once.map((t) => ({ id: t.id, weight: w }))];
  }, [props.deck, props.once, settings.onceShare]);
  const byId = useMemo(() => new Map([...props.deck, ...props.once].map((t) => [t.id, t])), [props.deck, props.once]);

  const [seen, setSeen] = useState<string[]>([]);
  const [hand, setHand] = useState<string[]>(() => drawManyWeighted(items, HAND));
  const [votes, setVotes] = useState<[Record<string, Vote>, Record<string, Vote>]>([{}, {}]);
  const [step, setStep] = useState<Step>({ kind: 'deal' });
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, reduced ? 0 : ms));
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    if (step.kind === 'deal') later(1000, () => setStep({ kind: 'handoff', player: 0 }));
  }, [step.kind]);

  const result = matchVotes(hand, votes[0], votes[1]);

  const decide = (id: string) => {
    setStep({ kind: 'decided', id });
    buzz([15, 60, 25]);
    later(1000, () => props.onDecide(byId.get(id)!));
  };

  const redeal = () => {
    const nextSeen = [...seen, ...hand];
    let next = drawManyWeighted(items, HAND, nextSeen);
    if (next.length < 2) {
      // 山札を使い切ったら最初から
      next = drawManyWeighted(items, HAND, hand);
      setSeen([]);
    } else setSeen(nextSeen);
    setHand(next);
    setVotes([{}, {}]);
    setStep({ kind: 'deal' });
  };

  const afterReveal = () => {
    if (result.both.length === 1) decide(result.both[0]);
    else if (result.both.length > 1) setStep({ kind: 'roulette', pool: result.both });
  };

  if (hand.length < 2) {
    return (
      <div className="screen">
        <TopBar title="ふたりで選ぶ" onBack={props.onBack} />
        <p className="lead">候補が2枚未満です。条件をゆるめてください。</p>
      </div>
    );
  }

  return (
    <div className="screen pair">
      <TopBar title="ふたりで選ぶ" onBack={props.onBack} />

      {step.kind === 'deal' && (
        <div className="stack center">
          <div className="draw__stage">
            <Shuffle />
          </div>
          <p className="draw__hint">{hand.length}枚配っています…</p>
        </div>
      )}

      {step.kind === 'handoff' && (
        <div className={`handoff ${step.player === 0 ? 'owner-a' : 'owner-b'}`}>
          <p className="handoff__eyebrow">{step.player === 0 ? 'まずは' : 'スマホを渡してね'}</p>
          <h2 className="handoff__name">
            {names[step.player]}
            <span>の番</span>
          </h2>
          <p className="handoff__note">{hand.length}枚のカードに、こっそり「あり／なし」をつけます</p>
          <button
            type="button"
            className="btn btn--player"
            onClick={() => setStep({ kind: 'vote', player: step.player })}
          >
            {names[step.player]}です、見る
          </button>
          <p className="handoff__hint">相手は画面を見ないでね</p>
        </div>
      )}

      {step.kind === 'vote' && (
        <SwipeVote
          key={step.player}
          player={step.player}
          name={names[step.player]}
          topics={hand.map((id) => byId.get(id)!)}
          onDone={(v) => {
            const next: [Record<string, Vote>, Record<string, Vote>] = [...votes];
            next[step.player] = v;
            setVotes(next);
            setStep(step.player === 0 ? { kind: 'handoff', player: 1 } : { kind: 'ready' });
          }}
        />
      )}

      {step.kind === 'ready' && (
        <div className="stack center seeno-wrap">
          <p className="lead">ふたりで画面を見てね</p>
          <button type="button" className="btn btn--seeno" onClick={() => setStep({ kind: 'reveal' })}>
            せーの！
          </button>
        </div>
      )}

      {(step.kind === 'reveal' || step.kind === 'roulette' || step.kind === 'decided') && (
        <Reveal
          names={names}
          topics={hand.map((id) => byId.get(id)!)}
          votes={votes}
          both={result.both}
          hide={settings.hideVotes}
          step={step}
          onRouletteDone={decide}
        />
      )}

      {step.kind === 'reveal' && (
        <div className="actions reveal-actions">
          {result.both.length === 1 && (
            <button type="button" className="btn btn--primary btn--big" onClick={afterReveal}>
              これに決定！
            </button>
          )}
          {result.both.length > 1 && (
            <button type="button" className="btn btn--primary btn--big" onClick={afterReveal}>
              {result.both.length}枚からルーレットで決める
            </button>
          )}
          {result.both.length === 0 && (
            <>
              <p className="lead center-text">ふたりとも「あり」のカードはなかった…</p>
              <button type="button" className="btn btn--primary" onClick={redeal}>
                新しく{HAND}枚配る
              </button>
              {result.either.length > 0 && (
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setStep({ kind: 'roulette', pool: result.either })}
                >
                  どちらかが「あり」の{result.either.length}枚からルーレット
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** 1枚ずつ「あり／なし」。左右スワイプでもボタンでも選べる */
function SwipeVote(props: { player: Player; name: string; topics: Topic[]; onDone: (v: Record<string, Vote>) => void }) {
  const [i, setI] = useState(0);
  const [votes, setVotes] = useState<Record<string, Vote>>({});
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState<Vote | null>(null);
  const start = useRef<number | null>(null);
  const reduced = useMemo(prefersReducedMotion, []);
  const t = props.topics[i];

  const choose = (v: Vote) => {
    if (leaving || !t) return;
    buzz(8);
    setLeaving(v);
    const next = { ...votes, [t.id]: v };
    setTimeout(
      () => {
        setVotes(next);
        setLeaving(null);
        setDx(0);
        if (i + 1 >= props.topics.length) props.onDone(next);
        else setI(i + 1);
      },
      reduced ? 0 : 260,
    );
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') choose('yes');
      if (e.key === 'ArrowLeft') choose('no');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!t) return null;
  const tilt = leaving ? 0 : dx / 18;
  const hint = dx > 40 ? 'yes' : dx < -40 ? 'no' : null;

  return (
    <div className="stack swipe">
      <p className="lead">
        <PlayerDot player={props.player} />
        {props.name}は、これやりたい？
      </p>
      <div className="swipe__dots" aria-label={`${i + 1}枚目 / ${props.topics.length}枚`}>
        {props.topics.map((x, k) => (
          <span
            key={x.id}
            className={`swipe__dot ${k === i ? 'is-current' : ''} ${votes[x.id] === 'yes' ? 'is-yes' : votes[x.id] === 'no' ? 'is-no' : ''}`}
          />
        ))}
      </div>
      <div className="swipe__stage">
        {props.topics[i + 1] && (
          <div className="swipe__next" aria-hidden="true">
            <TopicCard topic={props.topics[i + 1]} big />
          </div>
        )}
        <div
          key={t.id}
          className={`swipe__card ${props.player === 0 ? 'owner-a' : 'owner-b'} ${leaving ? `is-leaving-${leaving}` : ''} ${dx === 0 && !leaving ? 'is-settled' : ''}`}
          style={leaving ? undefined : { transform: `translateX(${dx}px) rotate(${tilt}deg)` }}
          onPointerDown={(e) => {
            start.current = e.clientX;
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (start.current !== null) setDx(e.clientX - start.current);
          }}
          onPointerUp={() => {
            const d = dx;
            start.current = null;
            if (d > 90) choose('yes');
            else if (d < -90) choose('no');
            else setDx(0);
          }}
          onPointerCancel={() => {
            start.current = null;
            setDx(0);
          }}
        >
          <TopicCard topic={t} big />
          <span className={`swipe__badge swipe__badge--yes ${hint === 'yes' || leaving === 'yes' ? 'is-on' : ''}`}>あり</span>
          <span className={`swipe__badge swipe__badge--no ${hint === 'no' || leaving === 'no' ? 'is-on' : ''}`}>なし</span>
        </div>
      </div>
      <div className="swipe__buttons">
        <button type="button" className="vote-btn vote-btn--no" onClick={() => choose('no')} aria-label="なし">
          <span aria-hidden="true">✕</span>
          なし
        </button>
        <button type="button" className="vote-btn vote-btn--yes" onClick={() => choose('yes')} aria-label="あり">
          <span aria-hidden="true">○</span>
          あり
        </button>
      </div>
      <p className="muted center-text">左右にスワイプしてもOK</p>
    </div>
  );
}

function Reveal(props: {
  names: [string, string];
  topics: Topic[];
  votes: [Record<string, Vote>, Record<string, Vote>];
  both: string[];
  hide: boolean;
  step: Step;
  onRouletteDone: (id: string) => void;
}) {
  const { step } = props;
  const [lit, setLit] = useState<string | null>(null);
  const done = useRef(props.onRouletteDone);
  done.current = props.onRouletteDone;

  useEffect(() => {
    if (step.kind !== 'roulette') return;
    const pool = step.pool;
    const final = pool[Math.floor(Math.random() * pool.length)];
    if (prefersReducedMotion()) {
      setLit(final);
      const t = setTimeout(() => done.current(final), 500);
      return () => clearTimeout(t);
    }
    const target = pool.length * 4 + pool.indexOf(final);
    let k = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setLit(pool[k % pool.length]);
      buzz(4);
      if (k >= target) {
        timer = setTimeout(() => done.current(final), 700);
        return;
      }
      k++;
      timer = setTimeout(tick, 60 + (k / target) ** 3 * 360);
    };
    tick();
    return () => clearTimeout(timer);
  }, [step]);

  const decidedId = step.kind === 'decided' ? step.id : null;

  return (
    <ul className="reveal-list">
      {props.topics.map((t, k) => {
        const a = props.votes[0][t.id];
        const b = props.votes[1][t.id];
        const match = props.both.includes(t.id);
        const isLit = lit === t.id || decidedId === t.id;
        const dim = (decidedId && decidedId !== t.id) || (step.kind === 'roulette' && !step.pool.includes(t.id));
        return (
          <li
            key={t.id}
            className={`reveal-item ${match ? 'is-match' : ''} ${isLit ? 'is-lit' : ''} ${dim ? 'is-dim' : ''}`}
            style={{ animationDelay: `${k * 90}ms` }}
          >
            <div className="reveal-item__text">
              <span className="ticket__cat">{t.category}</span>
              <span>{t.text}</span>
            </div>
            {!props.hide && (
            <div className="reveal-item__votes">
              <span className={`vote-mark owner-a ${a === 'yes' ? 'is-yes' : ''}`} title={props.names[0]}>
                {a === 'yes' ? '○' : '✕'}
              </span>
              <span className={`vote-mark owner-b ${b === 'yes' ? 'is-yes' : ''}`} title={props.names[1]}>
                {b === 'yes' ? '○' : '✕'}
              </span>
            </div>
            )}
            {match && <span className="reveal-item__tag">ふたりとも！</span>}
            {decidedId === t.id && (
              <span className="stamp-big stamp-big--small" aria-hidden="true">
                決定！
              </span>
            )}
          </li>
        );
      })}
      {props.hide ? (
        <li className="reveal-legend">ふたりの答えは隠しています（ふたりとも「あり」のカードだけ分かります）</li>
      ) : (
        <li className="reveal-legend" aria-hidden="true">
          <span>
            <PlayerDot player={0} /> {props.names[0]}
          </span>
          <span>
            <PlayerDot player={1} /> {props.names[1]}
          </span>
        </li>
      )}
    </ul>
  );
}
