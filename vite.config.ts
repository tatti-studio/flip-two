import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { viteSingleFile } from 'vite-plugin-singlefile';

// 通常: npm run build → dist/（普通の Web アプリ）
// 公開ページ用: npm run build:artifact → 1枚の HTML（React は CDN から読む）
export default defineConfig(({ mode }) => {
  if (mode === 'fakesync')
    // 動作確認用: 同期先を test-sync/server.mjs に差し替える
    return {
      plugins: [react()],
      build: { outDir: 'dist-fakesync' },
      resolve: {
        alias: [{ find: /^\.\.?\/(sync\/)?sync$/, replacement: fileURLToPath(new URL('./test-sync/fake.ts', import.meta.url)) }],
      },
    };
  if (mode !== 'artifact')
    return {
      // GitHub Pages（https://ユーザー名.github.io/リポジトリ名/）でも動くよう相対パスにする
      base: './',
      plugins: [
        react(),
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['favicon.png', 'icons/apple-touch-icon.png'],
          manifest: {
            name: 'Flip Two ─ 次、なにする？',
            short_name: 'Flip Two',
            description: 'ふたりの「次なにする？」をカードで決めるアプリ',
            lang: 'ja',
            start_url: './',
            scope: './',
            display: 'standalone',
            background_color: '#f3f1f6',
            theme_color: '#f3f1f6',
            icons: [
              { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
              { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
              { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
            ],
          },
          workbox: {
            globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
            // フォントもオフラインで使えるようにキャッシュする
            runtimeCaching: [
              {
                urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
                handler: 'CacheFirst',
                options: { cacheName: 'fonts', expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 } },
              },
            ],
          },
        }),
      ],
    };
  return {
    plugins: [
      react(),
      viteSingleFile(),
      {
        name: 'react-from-cdn',
        transformIndexHtml(html: string) {
          const cdn =
            '<script crossorigin src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>\n' +
            '    <script crossorigin src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>\n';
          return html.replace('</head>', `    ${cdn}  </head>`);
        },
      },
    ],
    resolve: {
      alias: [
        { find: /^react\/jsx-runtime$/, replacement: fileURLToPath(new URL('./src/shims/jsx-runtime.ts', import.meta.url)) },
        // 公開ページでは外部と通信できないので、同期は「なし」の実装に差し替える
        { find: /^\.\.?\/(sync\/)?sync$/, replacement: fileURLToPath(new URL('./src/sync/stub.ts', import.meta.url)) },
      ],
    },
    build: {
      outDir: 'dist-artifact',
      rollupOptions: {
        external: ['react', 'react-dom', 'react-dom/client'],
        output: {
          format: 'iife',
          globals: { react: 'React', 'react-dom': 'ReactDOM', 'react-dom/client': 'ReactDOM' },
        },
      },
    },
  };
});
