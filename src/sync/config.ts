// Firebase の設定。SETUP.md の手順で Firebase プロジェクトを作り、
// 「ウェブアプリを追加」で表示される firebaseConfig の中身をここに貼る。
// null のままなら同期は使わず、端末の中だけで動く。
//
// 例:
// export const firebaseConfig = {
//   apiKey: 'AIza...',
//   authDomain: 'futari-xxxx.firebaseapp.com',
//   projectId: 'futari-xxxx',
//   storageBucket: 'futari-xxxx.firebasestorage.app',
//   messagingSenderId: '1234567890',
//   appId: '1:1234567890:web:abcdef',
// };
import type { FirebaseOptions } from 'firebase/app';

export const firebaseConfig: FirebaseOptions | null = null;
