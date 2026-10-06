import type { Memory, Settings, TopicPrefs } from '../lib/types';

/** ふたりで共有する設定とお題（条件の絞り込みは各自の端末のまま） */
export type Shared = { settings: Settings; prefs: TopicPrefs };

export type SyncStatus = 'off' | 'connecting' | 'synced' | 'offline' | 'error';

export type SyncApi = {
  available: boolean;
  newRoomId(): string;
  roomExists(roomId: string): Promise<{ names: [string, string] } | null>;
  watch(
    roomId: string,
    on: {
      shared: (s: Shared) => void;
      memories: (m: Memory[]) => void;
      status: (s: SyncStatus) => void;
    },
  ): () => void;
  pushShared(roomId: string, s: Shared): Promise<void>;
  pushMemory(roomId: string, m: Memory): Promise<void>;
  removeMemory(roomId: string, id: string): Promise<void>;
  pushPhoto(roomId: string, id: string, blob: Blob): Promise<void>;
  fetchPhoto(roomId: string, id: string): Promise<Blob | null>;
  removePhoto(roomId: string, id: string): Promise<void>;
  qrDataUrl(text: string): Promise<string>;
};
