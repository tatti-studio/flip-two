// 公開ページ用ビルドでだけ使う。React を CDN の UMD 版（グローバル React）から読むため、
// 新しい JSX 変換の呼び出しを React.createElement に置き換える。
import React from 'react';

type Props = Record<string, unknown> | null;
export const Fragment = React.Fragment;
export function jsx(type: React.ElementType, props: Props, key?: React.Key) {
  return React.createElement(type, key === undefined ? props : { ...props, key });
}
export const jsxs = jsx;
