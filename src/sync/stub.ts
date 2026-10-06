// 公開ページ（claude.ai のアーティファクト）用。外部と通信できないので同期は無効。
import { makeRoomId } from './engine';
import type { SyncApi } from './types';

const off = () => Promise.reject(new Error('この環境では同期を使えません'));

export const sync: SyncApi = {
  available: false,
  newRoomId: () => makeRoomId(),
  roomExists: off,
  watch: (_roomId, on) => {
    on.status('off');
    return () => undefined;
  },
  pushShared: off,
  pushMemory: off,
  removeMemory: off,
  pushPhoto: off,
  fetchPhoto: () => Promise.resolve(null),
  removePhoto: off,
  qrDataUrl: off,
};
