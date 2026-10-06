import { useState, type ReactNode } from 'react';
import type { Player, Topic } from '../lib/types';
import { topicTags } from './labels';

/** お題カード。切符のような形で、上にカテゴリ、下の半券に条件タグ */
export function TopicCard(props: {
  topic: Topic;
  selected?: boolean;
  dim?: boolean;
  owner?: Player | null; // 誰の色で縁取るか
  onClick?: () => void;
  footer?: ReactNode;
  big?: boolean;
  animate?: boolean;
}) {
  const { topic, selected, dim, owner, onClick, footer, big, animate } = props;
  const cls = [
    'ticket',
    big ? 'ticket--big' : '',
    selected ? 'is-selected' : '',
    dim ? 'is-dim' : '',
    owner === 0 ? 'owner-a' : owner === 1 ? 'owner-b' : '',
    onClick ? 'is-tappable' : '',
    animate ? 'ticket--deal' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const body = (
    <>
      <div className="ticket__main">
        <span className="ticket__cat">{topic.category}</span>
        <p className="ticket__text">{topic.text}</p>
      </div>
      <div className="ticket__stub">
        {(topic.source === 'once' ? [] : topicTags(topic)).map((t) => (
          <span key={t} className="tag">
            {t}
          </span>
        ))}
        {topic.source === 'custom' && <span className="tag tag--own">ふたりのお題</span>}
        {topic.source === 'once' && <span className="tag tag--once">今回だけ</span>}
      </div>
      {footer}
    </>
  );
  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick} aria-pressed={selected}>
        {body}
      </button>
    );
  }
  return <div className={cls}>{body}</div>;
}

export function TopBar(props: { title: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <header className="topbar">
      {props.onBack ? (
        <button type="button" className="topbar__back" onClick={props.onBack} aria-label="戻る">
          ←
        </button>
      ) : (
        <span className="topbar__spacer" />
      )}
      <h1 className="topbar__title">{props.title}</h1>
      <span className="topbar__right">{props.right}</span>
    </header>
  );
}

/** 画面内で完結する確認ボタン（ブラウザのダイアログは使わない） */
export function ConfirmButton(props: { label: string; confirmLabel: string; onConfirm: () => void; className?: string }) {
  const [armed, setArmed] = useState(false);
  if (!armed) {
    return (
      <button type="button" className={props.className ?? 'btn btn--ghost'} onClick={() => setArmed(true)}>
        {props.label}
      </button>
    );
  }
  return (
    <span className="confirm">
      <button type="button" className="btn btn--danger" onClick={props.onConfirm}>
        {props.confirmLabel}
      </button>
      <button type="button" className="btn btn--ghost" onClick={() => setArmed(false)}>
        やめる
      </button>
    </span>
  );
}

export function PlayerDot({ player }: { player: Player }) {
  return <span className={`dot ${player === 0 ? 'owner-a' : 'owner-b'}`} aria-hidden="true" />;
}

export function Chips<T extends string | number | null>(props: {
  options: { value: T; label: string }[];
  value: T | T[];
  onChange: (v: T) => void;
  name: string;
}) {
  const isMulti = Array.isArray(props.value);
  return (
    <div className="chips" role="group" aria-label={props.name}>
      {props.options.map((o) => {
        const on = isMulti ? (props.value as T[]).includes(o.value) : props.value === o.value;
        return (
          <button
            key={String(o.value)}
            type="button"
            className={`chip ${on ? 'is-on' : ''}`}
            aria-pressed={on}
            onClick={() => props.onChange(o.value)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** 日付を数字8桁で打ち込む欄（例: 20240101 → 2024/01/01）。スマホでは数字キーボードが出る */
export function DateDigits(props: { id: string; value: string | null; onChange: (iso: string | null) => void }) {
  const toText = (iso: string | null) => (iso ? iso.replace(/-/g, '/') : '');
  const [text, setText] = useState(() => toText(props.value));
  const digits = text.replace(/\D/g, '');
  const iso = parseDigits(digits);
  const invalid = digits.length === 8 && !iso;
  return (
    <span className="date-digits">
      <input
        id={props.id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="例: 20240101"
        value={text}
        aria-invalid={invalid}
        onChange={(e) => {
          const d = e.target.value.replace(/\D/g, '').slice(0, 8);
          const formatted = d.length > 6 ? `${d.slice(0, 4)}/${d.slice(4, 6)}/${d.slice(6)}` : d.length > 4 ? `${d.slice(0, 4)}/${d.slice(4)}` : d;
          setText(formatted);
          if (d.length === 0) props.onChange(null);
          else if (d.length === 8) props.onChange(parseDigits(d));
        }}
      />
      {invalid && <span className="error-text">その日付はありません。年4桁・月2桁・日2桁で入れてください</span>}
    </span>
  );
}

/** "20240101" → "2024-01-01"（存在しない日付や未来の日付は null） */
export function parseDigits(d: string): string | null {
  if (!/^\d{8}$/.test(d)) return null;
  const y = Number(d.slice(0, 4));
  const m = Number(d.slice(4, 6));
  const day = Number(d.slice(6, 8));
  const dt = new Date(y, m - 1, day);
  if (y < 1900 || dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== day) return null;
  if (dt.getTime() > Date.now()) return null;
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}
