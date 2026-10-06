// 端末内保存。localStorage が使えない環境（プライベートモードなど）ではメモリに置き、アプリは動き続ける。
// 写真（Blob）は IndexedDB、それ以外は localStorage に JSON で保存する。

// 保存名は旧名のまま（変えると今までの記録が読めなくなるため）
const PREFIX = 'korekara2:';
const memory = new Map<string, string>();

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw !== null) return JSON.parse(raw) as T;
  } catch {
    const raw = memory.get(key);
    if (raw !== undefined) return JSON.parse(raw) as T;
  }
  return fallback;
}

export function save<T>(key: string, value: T): void {
  const raw = JSON.stringify(value);
  memory.set(key, raw);
  try {
    localStorage.setItem(PREFIX + key, raw);
  } catch {
    /* 保存できない環境ではメモリのみ */
  }
}

export function remove(key: string): void {
  memory.delete(key);
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    /* noop */
  }
}

// ---- 写真 ----

const DB_NAME = 'korekara2-photos';
const STORE = 'photos';
const photoMemory = new Map<string, Blob>();

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** 同期中は写真もクラウドに置く。App から設定する */
type PhotoRemote = {
  put(id: string, blob: Blob): Promise<void>;
  get(id: string): Promise<Blob | null>;
  del(id: string): Promise<void>;
} | null;
let remote: PhotoRemote = null;
export function setPhotoRemote(r: PhotoRemote) {
  remote = r;
}

export async function putPhoto(id: string, blob: Blob, opts: { upload?: boolean } = {}): Promise<void> {
  if (remote && opts.upload !== false) remote.put(id, blob).catch(() => undefined);
  await putPhotoLocal(id, blob);
}

async function putPhotoLocal(id: string, blob: Blob): Promise<void> {
  photoMemory.set(id, blob);
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(blob, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function getPhoto(id: string): Promise<Blob | null> {
  const local = await getPhotoLocal(id);
  if (local || !remote) return local;
  const fetched = await remote.get(id).catch(() => null);
  if (fetched) await putPhotoLocal(id, fetched);
  return fetched;
}

export async function getPhotoLocal(id: string): Promise<Blob | null> {
  const cached = photoMemory.get(id);
  if (cached) return cached;
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
      req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function deletePhoto(id: string): Promise<void> {
  photoMemory.delete(id);
  if (remote) remote.del(id).catch(() => undefined);
  const db = await openDb();
  if (!db) return;
  try {
    db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id);
  } catch {
    /* noop */
  }
}

/** 写真を長辺 1280px の JPEG に縮めて容量を抑える */
export async function shrinkImage(file: File, maxSide = 1280): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), 'image/jpeg', 0.85));
  } catch {
    return file;
  }
}

export function newId(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 記念日から数えて何日目か（記念日当日 = 1日目） */
export function daysSince(anniversary: string, on: string): number {
  const a = Date.parse(anniversary + 'T00:00:00');
  const b = Date.parse(on + 'T00:00:00');
  return Math.floor((b - a) / 86400000) + 1;
}

/** ブラウザに「このサイトのデータを勝手に消さないで」と頼む（ホーム画面アプリだと通りやすい） */
export async function requestPersist(): Promise<boolean> {
  try {
    if (await navigator.storage?.persisted?.()) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
