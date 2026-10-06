import { useEffect, useState } from 'react';
import { parseInvite } from '../sync/engine';
import type { SyncHandle } from '../sync/useSync';
import { ConfirmButton } from '../ui/common';

const STATUS_LABEL = {
  off: '同期していません',
  connecting: 'つないでいます…',
  synced: '同期中',
  offline: 'オフライン（つながったら送ります）',
  error: 'うまく同期できていません',
} as const;

export function inviteLink(room: string): string {
  try {
    return `${location.origin}${location.pathname}?join=${room}`;
  } catch {
    return room;
  }
}

/** 設定画面の「ふたりで同期」 */
export function SyncPanel(props: { s: SyncHandle; partnerHint: string }) {
  const { s } = props;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState('');

  // 同期は Firebase を設定したときだけ使う（未設定なら1台で使うので何も出さない）
  if (!s.available) return null;

  const run = async (label: string, fn: (p: (d: number, t: number) => void) => Promise<unknown>) => {
    setError(null);
    setBusy(label);
    try {
      await fn((d, t) => setBusy(`${label}（写真 ${d}/${t}）`));
    } catch (e) {
      setError(e instanceof Error ? e.message : '同期を始められませんでした。通信状態を確かめてください');
    } finally {
      setBusy(null);
    }
  };

  if (!s.room) {
    return (
      <section className="panel stack">
        <h2 className="label">ふたりで同期</h2>
        <p className="muted">
          同期すると、ふたりのスマホで同じアルバム・お題・設定を使えます。どちらか片方が「同期を始める」を押し、出てきたQRコードを{props.partnerHint}のスマホで読み取ってください。
        </p>
        <button type="button" className="btn btn--primary" disabled={!!busy} onClick={() => run('準備中', (p) => s.start(p))}>
          {busy ?? '同期を始める'}
        </button>
        <form
          className="once-form"
          onSubmit={(e) => {
            e.preventDefault();
            const c = parseInvite(code);
            if (!c) {
              setError('招待コードの形が違います。QRコードを読み取るか、リンクをそのまま貼ってください');
              return;
            }
            void run('参加中', (p) => s.join(c, p));
          }}
        >
          <input
            id="invite-code"
            value={code}
            placeholder="招待コード または 招待リンク"
            onChange={(e) => setCode(e.target.value)}
          />
          <button type="submit" className="btn btn--ghost btn--small" disabled={!code.trim() || !!busy}>
            参加
          </button>
        </form>
        {error && <p className="error-text">{error}</p>}
      </section>
    );
  }

  return (
    <section className="panel stack">
      <div className="sync-head">
        <h2 className="label">ふたりで同期</h2>
        <span className={`sync-status sync-status--${s.status}`}>{STATUS_LABEL[s.status]}</span>
      </div>
      <Invite s={s} room={s.room} />
      <ConfirmButton label="このスマホの同期をやめる" confirmLabel="同期をやめる" onConfirm={s.leave} />
      <p className="muted">やめても、このスマホにある記録はそのまま残ります。</p>
    </section>
  );
}

function Invite(props: { s: SyncHandle; room: string }) {
  const link = inviteLink(props.room);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    props.s.qr(link).then(setQr, () => setQr(null));
  }, [link]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* 手で選んでコピーしてもらう */
    }
  };
  const share = async () => {
    try {
      await navigator.share({ title: 'Flip Two', text: 'ふたりのアプリに招待します', url: link });
    } catch {
      void copy();
    }
  };
  return (
    <div className="invite">
      <p className="muted">相手のスマホのカメラでQRコードを読み取るか、リンクを送ってください。</p>
      {qr && <img className="invite__qr" src={qr} alt="招待用のQRコード" width={200} height={200} />}
      <input className="invite__link" id="invite-link" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
      <div className="veto__row">
        <button type="button" className="btn btn--ghost btn--small" onClick={copy}>
          {copied ? 'コピーしました' : 'リンクをコピー'}
        </button>
        {'share' in navigator && (
          <button type="button" className="btn btn--primary btn--small" onClick={share}>
            LINEなどで送る
          </button>
        )}
      </div>
      <p className="muted">このリンクを知っている人は誰でも中身を見られます。ふたり以外には送らないでください。</p>
    </div>
  );
}

/** 招待リンクから開いたときに出す案内 */
export function InviteBanner(props: { s: SyncHandle; code: string; onDone: () => void; onDismiss: () => void }) {
  const [names, setNames] = useState<[string, string] | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'joining' | 'error'>('loading');
  const [progress, setProgress] = useState('');
  useEffect(() => {
    if (!props.s.available) {
      setState('missing');
      return;
    }
    props.s.peek(props.code).then(
      (info) => {
        if (info) {
          setNames(info.names);
          setState('ready');
        } else setState('missing');
      },
      () => setState('error'),
    );
  }, [props.code]);

  return (
    <section className="invite-banner" role="dialog" aria-label="招待">
      {state === 'loading' && <p className="lead">招待を確かめています…</p>}
      {(state === 'ready' || state === 'joining') && (
        <>
          <p className="invite-banner__eyebrow">招待されています</p>
          <p className="lead">
            {names?.filter(Boolean).join(' と ') || 'ふたり'}のアプリに参加しますか？
          </p>
          <p className="muted">参加すると、アルバム・お題・設定が相手のスマホと同じになります。このスマホの記録も合わせて残ります。</p>
          <div className="veto__row">
            <button
              type="button"
              className="btn btn--primary"
              disabled={state === 'joining'}
              onClick={async () => {
                setState('joining');
                try {
                  await props.s.join(props.code, (d, t) => setProgress(`写真 ${d}/${t}`));
                  props.onDone();
                } catch {
                  setState('error');
                }
              }}
            >
              {state === 'joining' ? `参加中… ${progress}` : '参加する'}
            </button>
            <button type="button" className="btn btn--ghost" onClick={props.onDismiss}>
              あとで
            </button>
          </div>
        </>
      )}
      {state === 'missing' && (
        <>
          <p className="lead">招待が見つかりませんでした</p>
          <p className="muted">リンクが途中で切れていないか確かめてください。</p>
          <button type="button" className="btn btn--ghost" onClick={props.onDismiss}>
            閉じる
          </button>
        </>
      )}
      {state === 'error' && (
        <>
          <p className="lead">つながりませんでした</p>
          <p className="muted">通信できる場所で、もう一度リンクを開いてください。</p>
          <button type="button" className="btn btn--ghost" onClick={props.onDismiss}>
            閉じる
          </button>
        </>
      )}
    </section>
  );
}
