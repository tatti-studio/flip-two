// Firebase（Firestore + 匿名ログイン）での同期。
// データの形:
//   rooms/{roomId}                 … 共有する設定とお題（Shared）
//   rooms/{roomId}/memories/{id}   … 思い出1件
//   rooms/{roomId}/photos/{id}     … 写真1枚（縮小した JPEG を base64 で保存。無料プランで使えるように Storage は使わない）
// 招待コード（roomId）を知っている人だけが読み書きできる。
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import QRCode from 'qrcode';
import type { Memory } from '../lib/types';
import { firebaseConfig } from './config';
import { makeRoomId } from './engine';
import type { Shared, SyncApi, SyncStatus } from './types';

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let ready: Promise<void> | null = null;

function connect(): Promise<void> {
  if (!firebaseConfig) return Promise.reject(new Error('Firebase が設定されていません'));
  if (!ready) {
    app = initializeApp(firebaseConfig);
    try {
      db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
    } catch {
      db = initializeFirestore(app, {});
    }
    ready = signInAnonymously(getAuth(app)).then(() => undefined);
  }
  return ready;
}

/** Firestore は undefined を保存できないので落とす */
function clean<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

/** 1枚 1MB の上限に収まるまで縮める */
async function fitPhoto(blob: Blob): Promise<string> {
  let b64 = await blobToBase64(blob);
  let side = 1280;
  let quality = 0.8;
  while (b64.length > 900_000 && side > 400) {
    side = Math.round(side * 0.8);
    quality = Math.max(0.6, quality - 0.05);
    try {
      const bmp = await createImageBitmap(blob);
      const scale = Math.min(1, side / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * scale);
      c.height = Math.round(bmp.height * scale);
      c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
      const smaller = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', quality));
      if (!smaller) break;
      b64 = await blobToBase64(smaller);
    } catch {
      break;
    }
  }
  return b64;
}

export const sync: SyncApi = {
  available: !!firebaseConfig,

  newRoomId: () => makeRoomId(),

  async roomExists(roomId) {
    await connect();
    const snap = await getDoc(doc(db!, 'rooms', roomId));
    if (!snap.exists()) return null;
    const data = snap.data() as Partial<Shared>;
    return { names: (data.settings?.names ?? ['', '']) as [string, string] };
  },

  watch(roomId, on) {
    let stopped = false;
    const unsubs: (() => void)[] = [];
    const status = (s: SyncStatus) => !stopped && on.status(s);
    status('connecting');
    connect()
      .then(() => {
        if (stopped) return;
        const room = doc(db!, 'rooms', roomId);
        unsubs.push(
          onSnapshot(
            room,
            { includeMetadataChanges: true },
            (snap) => {
              status(snap.metadata.fromCache ? 'offline' : 'synced');
              if (snap.exists() && !snap.metadata.hasPendingWrites) on.shared(snap.data() as Shared);
            },
            () => status('error'),
          ),
        );
        unsubs.push(
          onSnapshot(
            collection(room, 'memories'),
            (snap) => {
              if (snap.metadata.hasPendingWrites) return;
              on.memories(snap.docs.map((d) => d.data() as Memory));
            },
            () => status('error'),
          ),
        );
      })
      .catch(() => status('error'));
    return () => {
      stopped = true;
      unsubs.forEach((u) => u());
    };
  },

  async pushShared(roomId, s) {
    await connect();
    await setDoc(doc(db!, 'rooms', roomId), { ...clean(s), updatedAt: Date.now() });
  },

  async pushMemory(roomId, m) {
    await connect();
    await setDoc(doc(db!, 'rooms', roomId, 'memories', m.id), clean(m));
  },

  async removeMemory(roomId, id) {
    await connect();
    await deleteDoc(doc(db!, 'rooms', roomId, 'memories', id));
  },

  async pushPhoto(roomId, id, blob) {
    await connect();
    await setDoc(doc(db!, 'rooms', roomId, 'photos', id), { data: await fitPhoto(blob), type: 'image/jpeg' });
  },

  async fetchPhoto(roomId, id) {
    await connect();
    const snap = await getDoc(doc(db!, 'rooms', roomId, 'photos', id));
    if (!snap.exists()) return null;
    const { data, type } = snap.data() as { data: string; type: string };
    const bin = atob(data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type });
  },

  async removePhoto(roomId, id) {
    await connect();
    await deleteDoc(doc(db!, 'rooms', roomId, 'photos', id));
  },

  qrDataUrl(text) {
    const css = getComputedStyle(document.documentElement);
    return QRCode.toDataURL(text, {
      margin: 1,
      width: 480,
      color: { dark: css.getPropertyValue('--ink').trim() || '#241f33', light: '#ffffff' },
    });
  },
};
