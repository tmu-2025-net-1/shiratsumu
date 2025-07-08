# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```bash
# create a new project in the current directory
npx sv create

# create a new project in my-app
npx sv create my-app
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```bash
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```bash
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

## Development Environment

- **Node.js:** v22.15.0
- **npm:** 10.9.2

### Dependencies

- @eslint/compat: ^1.2.5
- @eslint/js: ^9.18.0
- @sveltejs/adapter-auto: ^6.0.0
- @sveltejs/kit: ^2.16.0
- @sveltejs/vite-plugin-svelte: ^5.0.0
- @tailwindcss/vite: ^4.0.0
- @vitest/browser: ^3.2.3
- eslint: ^9.18.0
- eslint-config-prettier: ^10.0.1
- eslint-plugin-svelte: ^3.0.0
- globals: ^16.0.0
- p5: ^1.9.1
- playwright: ^1.53.0
- prettier: ^3.4.2
- prettier-plugin-svelte: ^3.3.3
- prettier-plugin-tailwindcss: ^0.6.11
- qrcode-generator: ^1.4.4
- svelte: ^5.0.0
- svelte-check: ^4.0.0
- tailwindcss: ^4.0.0
- typescript: ^5.0.0
- typescript-eslint: ^8.20.0
- vite: ^6.2.6
- vitest: ^3.2.3
- vitest-browser-svelte: ^0.1.0

## Project Features

### Grid-Style ASCII QR Generator

The project includes a Grid-Style ASCII QR Code generator that renders QR codes with ASCII characters. It supports:

- Interactive QR code generation with customizable text
- Different background effects: Static Grid, Animated Grid, Matrix Grid, and Neon Grid
- Various interaction modes: Hover, Ripple, and Glow effects
- Customizable cell size, font size, and character set
- QR code error correction level settings
- Animation speed control
- Image download functionality

## QRコードジェネレーターの使用方法

このアプリケーションには、p5.jsを使用したインタラクティブなグリッドスタイルASCII QRコードジェネレーターが含まれています。以下は機能の詳細です：

### 主な機能

- **テキストエンコード**: 任意のテキストをQRコードに変換
- **カスタマイズ可能な外観**: セルサイズ、フォントサイズ、文字セットなどを調整可能
- **バックグラウンドエフェクト**: 
  - Static Grid: 静的なグリッドパターン
  - Animated Grid: パルスするキャラクターによるアニメーション
  - Matrix Grid: 「マトリックス」スタイルの落ちる文字
  - Neon Grid: ネオンスタイルの光るグリッド
- **インタラクティブ効果**:
  - Hover: マウスオーバー時にセルが反応
  - Ripple: クリックでリップルエフェクトが発生
  - Glow: マウスに近いセルが光る
- **QRエラー修正レベル**: L(7%), M(15%), Q(25%), H(30%)から選択可能
- **画像ダウンロード**: 生成したQRコードをPNG形式で保存

### 使用方法

1. 右上の「⚙️ Settings」ボタンをクリックしてコントロールパネルを表示
2. エンコードしたいテキストを入力
3. 希望する外観とインタラクション設定を調整
4. 「Generate」ボタンをクリックしてQRコードを生成
5. 必要に応じて「Download」ボタンでQRコードの画像を保存

### 技術的詳細

このコンポーネントはSvelteKit環境でp5.jsを使用しており、クライアントサイドでのみレンダリングされます。サーバーサイドレンダリングは`+page.ts`ファイルで無効化されています。

QRコード生成には`qrcode-generator`ライブラリが使用されています。
