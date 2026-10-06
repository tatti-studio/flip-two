// ホーム画面への追加をすすめる案内（ブラウザで開いているときだけ）
import { useState } from 'react';
import { load, save } from '../lib/storage';

function isStandalone(): boolean {
  try {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
}

function isIOS(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

export function InstallHint() {
  const [hidden, setHidden] = useState(() => isStandalone() || load('installHintClosed', false));
  if (hidden) return null;
  return (
    <section className="install-hint">
      <div>
        <p className="install-hint__title">ホーム画面に追加しよう</p>
        <p className="muted">
          アプリのように開けて、記録も消えにくくなります。
          {isIOS() ? 'Safari の共有ボタン → 「ホーム画面に追加」' : 'ブラウザのメニュー → 「アプリをインストール」または「ホーム画面に追加」'}
        </p>
      </div>
      <button
        type="button"
        className="once-list__remove"
        aria-label="閉じる"
        onClick={() => {
          save('installHintClosed', true);
          setHidden(true);
        }}
      >
        ×
      </button>
    </section>
  );
}
