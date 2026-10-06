// 動作確認用: test-sync/server.mjs と話す SyncApi（npm run build -- --mode fakesync で使う）
import { makeRoomId, stable } from '../src/sync/engine';
import type { Memory } from '../src/lib/types';
import type { Shared, SyncApi } from '../src/sync/types';

const BASE = 'http://localhost:8787';
const j = (r: Response) => (r.ok ? r.json() : null);
const put = (p: string, v: unknown) => fetch(BASE + p, { method: 'PUT', body: JSON.stringify(v) }).then(() => undefined);
const del = (p: string) => fetch(BASE + p, { method: 'DELETE' }).then(() => undefined);

async function toB64(b: Blob) {
  const buf = new Uint8Array(await b.arrayBuffer());
  let s = '';
  for (const x of buf) s += String.fromCharCode(x);
  return btoa(s);
}

export const sync: SyncApi = {
  available: true,
  newRoomId: () => makeRoomId(),
  async roomExists(id) {
    const r = (await fetch(`${BASE}/rooms/${id}`).then(j)) as Shared | null;
    return r ? { names: r.settings.names } : null;
  },
  watch(id, on) {
    let lastS = '';
    let lastM = '';
    let stop = false;
    on.status('connecting');
    const tick = async () => {
      if (stop) return;
      try {
        const s = await fetch(`${BASE}/rooms/${id}`).then(j);
        if (s && stable(s) !== lastS) {
          lastS = stable(s);
          on.shared(s as Shared);
        }
        const m = (await fetch(`${BASE}/rooms/${id}/memories?list=1`).then(j)) as Memory[];
        if (stable(m) !== lastM) {
          lastM = stable(m);
          on.memories(m);
        }
        on.status('synced');
      } catch {
        on.status('offline');
      }
      setTimeout(tick, 400);
    };
    void tick();
    return () => {
      stop = true;
    };
  },
  pushShared: (id, s) => put(`/rooms/${id}`, s),
  pushMemory: (id, m) => put(`/rooms/${id}/memories/${m.id}`, m),
  removeMemory: (id, mid) => del(`/rooms/${id}/memories/${mid}`),
  pushPhoto: async (id, pid, b) => put(`/rooms/${id}/photos/${pid}`, { data: await toB64(b), type: b.type }),
  fetchPhoto: async (id, pid) => {
    const r = (await fetch(`${BASE}/rooms/${id}/photos/${pid}`).then(j)) as { data: string; type: string } | null;
    if (!r) return null;
    const bin = atob(r.data);
    return new Blob([Uint8Array.from(bin, (c) => c.charCodeAt(0))], { type: r.type });
  },
  removePhoto: (id, pid) => del(`/rooms/${id}/photos/${pid}`),
  qrDataUrl: () => Promise.resolve('data:image/gif;base64,R0lGODlhAQABAAAAACw='),
};
