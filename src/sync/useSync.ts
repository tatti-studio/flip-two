// App と同期をつなぐフック。
// 受け取ったデータで画面を更新し、自分の変更だけを送る（送ったものがまた返ってきて往復し続けないよう、
// 最後に送受信した内容を覚えておき、同じなら送らない）。
import { useEffect, useMemo, useRef, useState } from 'react';
import { getPhotoLocal, load, remove, save, setPhotoRemote } from '../lib/storage';
import type { Memory, Settings, TopicPrefs } from '../lib/types';
import { diffMemories, mergeMemories, pickShared, stable } from './engine';
import { sync } from './sync';
import type { SyncStatus } from './types';

type Args = {
  settings: Settings;
  setSettings: (f: (s: Settings) => Settings) => void;
  prefs: TopicPrefs;
  setPrefs: (f: (p: TopicPrefs) => TopicPrefs) => void;
  memories: Memory[];
  setMemories: (m: Memory[]) => void;
};

const byDateDesc = (a: Memory, b: Memory) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0);

export function useSync(a: Args) {
  const [room, setRoom] = useState<string | null>(() => (sync.available ? load<string | null>('room', null) : null));
  const [status, setStatus] = useState<SyncStatus>('off');
  const lastShared = useRef<string | null>(null);
  const lastMem = useRef<Map<string, string> | null>(null);
  const shared = useMemo(() => pickShared(a.settings, a.prefs), [a.settings, a.prefs]);
  const sharedJson = useMemo(() => stable(shared), [shared]);

  // 写真もクラウドへ
  useEffect(() => {
    if (!room) {
      setPhotoRemote(null);
      return;
    }
    setPhotoRemote({
      put: (id, b) => sync.pushPhoto(room, id, b),
      get: (id) => sync.fetchPhoto(room, id),
      del: (id) => sync.removePhoto(room, id),
    });
  }, [room]);

  // 受信
  useEffect(() => {
    lastShared.current = null;
    lastMem.current = null;
    if (!room) {
      setStatus('off');
      return;
    }
    return sync.watch(room, {
      status: setStatus,
      shared: (s) => {
        const picked = pickShared({ ...a.settings, ...s.settings }, { ...a.prefs, ...s.prefs });
        lastShared.current = stable(picked);
        a.setSettings((cur) => ({ ...cur, ...picked.settings }));
        a.setPrefs((cur) => ({ ...cur, ...picked.prefs }));
      },
      memories: (list) => {
        lastMem.current = new Map(list.map((m) => [m.id, stable(m)]));
        a.setMemories(list.slice().sort(byDateDesc));
      },
    });
  }, [room]);

  // 送信: 設定とお題
  useEffect(() => {
    if (!room || lastShared.current === null || sharedJson === lastShared.current) return;
    lastShared.current = sharedJson;
    sync.pushShared(room, shared).catch(() => setStatus('error'));
  }, [room, sharedJson]);

  // 送信: 思い出
  useEffect(() => {
    if (!room || lastMem.current === null) return;
    const { upserts, removes } = diffMemories(lastMem.current, a.memories);
    for (const m of upserts) {
      lastMem.current.set(m.id, stable(m));
      sync.pushMemory(room, m).catch(() => setStatus('error'));
    }
    for (const id of removes) {
      lastMem.current.delete(id);
      sync.removeMemory(room, id).catch(() => setStatus('error'));
    }
  }, [room, a.memories]);

  /** この端末の記録と写真をまとめて送る */
  async function uploadAll(roomId: string, memories: Memory[], onProgress?: (done: number, total: number) => void) {
    for (const m of memories) await sync.pushMemory(roomId, m);
    const photoIds = memories.flatMap((m) => m.photoIds);
    let done = 0;
    for (const id of photoIds) {
      const blob = await getPhotoLocal(id);
      if (blob) await sync.pushPhoto(roomId, id, blob);
      onProgress?.(++done, photoIds.length);
    }
  }

  return {
    available: sync.available,
    room,
    status,
    /** 新しく同期を始める（この端末のデータが最初の中身になる） */
    async start(onProgress?: (done: number, total: number) => void) {
      const id = sync.newRoomId();
      await sync.pushShared(id, shared);
      await uploadAll(id, a.memories, onProgress);
      save('room', id);
      setRoom(id);
      return id;
    },
    /** 招待コードで参加（設定とお題は相手のものを使い、記録は両方を合わせる） */
    async join(code: string, onProgress?: (done: number, total: number) => void) {
      const info = await sync.roomExists(code);
      if (!info) throw new Error('招待コードが見つかりません。もう一度確かめてください');
      await uploadAll(code, mergeMemories(a.memories, []), onProgress);
      save('room', code);
      setRoom(code);
      return info;
    },
    leave() {
      remove('room');
      setRoom(null);
    },
    peek: (code: string) => sync.roomExists(code),
    qr: (text: string) => sync.qrDataUrl(text),
  };
}

export type SyncHandle = ReturnType<typeof useSync>;
