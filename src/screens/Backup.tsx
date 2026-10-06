// バックアップの書き出し・読み込み（記録・写真・設定・お題をまとめて1つのファイルに）
import { useState } from 'react';
import { getPhoto, putPhoto } from '../lib/storage';
import type { Memory, Settings, TopicPrefs } from '../lib/types';
import { mergeMemories } from '../sync/engine';

type BackupFile = {
  app: 'flip-two' | 'korekara-futaride';
  version: 1;
  exportedAt: string;
  settings: Settings;
  prefs: TopicPrefs;
  memories: Memory[];
  photos: Record<string, { type: string; data: string }>;
};

async function toB64(b: Blob): Promise<string> {
  const buf = new Uint8Array(await b.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

export function BackupSection(props: {
  settings: Settings;
  prefs: TopicPrefs;
  memories: Memory[];
  onRestore: (d: { settings: Settings; prefs: TopicPrefs; memories: Memory[] }) => void;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const exportFile = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const photos: BackupFile['photos'] = {};
      for (const id of props.memories.flatMap((m) => m.photoIds)) {
        const b = await getPhoto(id);
        if (b) photos[id] = { type: b.type || 'image/jpeg', data: await toB64(b) };
      }
      const file: BackupFile = {
        app: 'flip-two',
        version: 1,
        exportedAt: new Date().toISOString(),
        settings: props.settings,
        prefs: props.prefs,
        memories: props.memories,
        photos,
      };
      const url = URL.createObjectURL(new Blob([JSON.stringify(file)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `FlipTwo_バックアップ_${file.exportedAt.slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setMsg(`記録 ${props.memories.length}件・写真 ${Object.keys(photos).length}枚を書き出しました`);
    } catch {
      setMsg('書き出せませんでした');
    } finally {
      setBusy(false);
    }
  };

  const importFile = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    setMsg(null);
    try {
      const data = JSON.parse(await f.text()) as BackupFile;
      if (data.app !== 'flip-two' && data.app !== 'korekara-futaride') throw new Error();
      for (const [id, p] of Object.entries(data.photos ?? {})) {
        const bin = atob(p.data);
        await putPhoto(id, new Blob([Uint8Array.from(bin, (c) => c.charCodeAt(0))], { type: p.type }));
      }
      const memories = mergeMemories(props.memories, data.memories ?? []);
      props.onRestore({ settings: data.settings, prefs: data.prefs, memories });
      setMsg(`読み込みました（記録は今あるものと合わせて ${memories.length}件）`);
    } catch {
      setMsg('このファイルは読み込めませんでした。書き出したバックアップファイルを選んでください');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel stack">
      <h2 className="label">バックアップ</h2>
      <p className="muted">機種変更や、もしものときのために。記録・写真・設定・お題を1つのファイルにまとめます。</p>
      <div className="veto__row">
        <button type="button" className="btn btn--ghost btn--small" disabled={busy} onClick={exportFile}>
          書き出す
        </button>
        <label className="btn btn--ghost btn--small file-btn">
          読み込む
          <input
            id="backup-file"
            type="file"
            accept="application/json,.json"
            onChange={(e) => {
              void importFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
      </div>
      {msg && (
        <p className="toast" role="status">
          {msg}
        </p>
      )}
    </section>
  );
}
