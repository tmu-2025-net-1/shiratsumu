## `+page.svelte`のTypeScriptコード解説

このマニュアルは、`src/routes/+page.svelte`ファイルで使われているTypeScriptの主要な機能について、Svelteコンポーネントの文脈に沿って初心者向けに解説するものです。

### 1. モジュールのインポート (`import`)

コードの先頭では、外部のライブラリやSvelteの機能を読み込んでいます。

**コード内の該当箇所:**
```typescript
// src/routes/+page.svelte の <script lang="ts">
import { onMount } from 'svelte';
import { browser } from '$app/environment';
import qrcode from 'qrcode-generator';
import type p5 from 'p5';
```

**解説:**
- `import { onMount } from 'svelte';`: Svelteが提供する機能の中から、`onMount`というライフサイクル関数だけを読み込んでいます。
- `import { browser } from '$app/environment';`: SvelteKitの機能で、コードがブラウザで実行されているか（`true`）、サーバーで実行されているか（`false`）を判定するために使います。
- `import qrcode from 'qrcode-generator';`: `qrcode-generator`ライブラリの主要な機能を`qrcode`という名前で読み込んでいます。
- `import type p5 from 'p5';`: `p5`の「型情報」だけをインポートします。`type`を付けることで、実際のプログラムの動作には影響を与えず、開発中のコードチェック（型チェック）のためだけに情報を利用できます。これにより、安全性を保ちつつ、プログラムを軽量に保てます。

---

### 2. 変数宣言と型定義 (`let` と `type`)

TypeScriptでは、変数に「どのような種類のデータが入るか」を明示できます（型注釈）。

**コード内の該当箇所:**
```typescript
// UIと連携する変数
let qrText: string = 'https://svelte.dev';
let errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H' = 'M';

// p5.jsとQRコードデータを保持する変数
let p5Instance: p5 | null = null;
type QrData = { qr: any; modules: number };
let qrData: QrData | null = null;

// HTML要素を保持する変数
let qrContainer: HTMLDivElement;
```

**解説:**
- `let qrText: string = ...`: `qrText`という変数には文字列（`string`）が入ることを示します。
- `errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H'`: `errorCorrectionLevel`変数には、`'L'`, `'M'`, `'Q'`, `'H'`の4つの文字列のいずれかしか入らないことを示します（リテラル型と共用体型）。
- `p5Instance: p5 | null = null;`: `p5Instance`には、`p5`のインスタンスか、まだ存在しないことを示す`null`が入ります。
- `type QrData = { ... };`: `QrData`という新しい「型」を定義しています。これにより、複雑なデータ構造に名前を付け、再利用しやすくなります。
- `let qrContainer: HTMLDivElement;`: `qrContainer`には、HTMLの`<div>`要素が入ることを示します。これはSvelteの`bind:this={qrContainer}`という機能で、HTML要素と変数を直接結びつける際に使われます。

---

### 3. リアクティブな処理 (`$: ...`)

Svelteでは、`$: `という接頭辞を変数宣言や文の前に付けると、その処理が依存する変数の値が変更されるたびに自動的に再実行されます。

**コード内の該当箇所:**
```typescript
$: cellSize = Math.max(5, 40 - (qrData ? qrData.modules / 2 : 0));
$: generateQrCode();
```

**解説:**
- `$: cellSize = ...`: `qrData`の値が変わるたびに、`cellSize`が自動的に再計算されます。
- `$: generateQrCode();`: この行は、`generateQrCode`関数内で使われている変数（`qrText`や`errorCorrectionLevel`など）のいずれかが変更されるたびに、`generateQrCode()`関数を自動的に呼び出します。これにより、ユーザーがテキストや設定を変更すると即座にQRコードが再生成される、という動作が実現できています。

---

### 4. ライフサイクル関数 (`onMount`)

`onMount`は、Svelteコンポーネントが画面に表示された直後に一度だけ実行される関数です。ブラウザでしか動かない処理の初期化に最適です。

**コード内の該当箇所:**
```typescript
onMount(() => {
  if (browser) { // ブラウザ環境でのみ実行
    import('p5').then(p5Module => {
      const p5Constructor = p5Module.default;
      // ... p5.jsのインスタンスを生成 ...
      p5Instance = new p5Constructor(sketch, qrContainer);
    });
  }

  return () => { // クリーンアップ関数
    if (p5Instance) {
      p5Instance.remove();
    }
  };
});
```

**解説:**
- `if (browser)`: p5.jsはサーバー上では動作しないため、ブラウザ環境であることを確認してから処理を始めます。
- `import('p5')`: p5.jsを動的にインポートします。これにより、ページの初期読み込みが高速になります。
- `return () => { ... }`: `onMount`から返されるこの関数は「クリーンアップ関数」と呼ばれ、コンポーネントが画面から消えるときに実行されます。`p5Instance.remove()`を呼ぶことで、不要になったp5.jsのキャンバスやイベントを片付け、メモリリークを防ぎます。

---

### 5. 型アサーション (`as`)

型アサーションは、開発者がTypeScriptに対して「この値の型は私が保証するので、この型として扱ってください」と伝える機能です。

**コード内の該当箇所:**
```typescript
const qr = qrcode(0, errorCorrectionLevel as 'L' | 'M' | 'Q' | 'H');
```

**解説:**
`qrcode-generator`ライブラリの`qrcode`関数は、エラー訂正レベルの型を厳密に定義していません。しかし、私たちは`errorCorrectionLevel`変数が`'L' | 'M' | 'Q' | 'H'`のいずれかであることを知っています。そこで`as`を使って「この変数は、この特定の型ですよ」とTypeScriptに教えることで、型チェックエラーを防いでいます。
