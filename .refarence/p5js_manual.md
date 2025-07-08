## `+page.svelte`のp5.jsコード解説

このマニュアルは、`src/routes/+page.svelte`ファイルで`p5.js`をどのように利用しているか、初心者向けに解説するものです。

### 1. p5.jsとは？

p5.jsは、アーティスト、デザイナー、教育者、初心者を対象とした、コーディングにアクセスしやすくするためのJavaScriptライブラリです。グラフィックやインタラクティブな体験を簡単に作成できます。

### 2. SvelteKitへの組み込み

`+page.svelte`では、`p5.js`をSvelteのライフサイクルと組み合わせて安全に利用しています。

#### 動的インポートと`onMount`

p5.jsはブラウザ環境でしか動作しないため、Svelteコンポーネントがマウントされた後（＝ブラウザで表示された後）に`onMount`内で動的に読み込みます。

```typescript
// src/routes/+page.svelte
onMount(() => {
  if (browser) { // ブラウザ環境でのみ実行
    import('p5').then(p5Module => {
      p5Constructor = p5Module.default;
      initP5Sketch(); // p5.jsのスケッチを初期化
    });
  }
  // ...
});
```
- `import('p5')`: これにより、ページ読み込み時にp5.jsを読み込むのではなく、必要なタイミングで非同期に読み込みます。これにより初期表示が高速になります。
- `p5Constructor = p5Module.default;`: 読み込んだp5.jsのコンストラクタ（設計図のようなもの）を保存します。
- `initP5Sketch()`: この関数の中で、実際にp5.jsのインスタンスを生成します。

#### スケッチのインスタンス化

```typescript
// src/routes/+page.svelte
function initP5Sketch() {
  if (p5Instance) {
    p5Instance.remove(); // 既存のインスタンスがあれば削除
  }
  // p5コンストラクタにsketch関数と描画先のDOM要素を渡す
  p5Instance = new p5Constructor(sketch, qrContainer);
}
```
- `new p5Constructor(sketch, qrContainer)`: これがp5.jsを起動する中心的なコードです。
    - `sketch`: p5.jsが実行する描画ロジックが書かれた関数。
    - `qrContainer`: p5.jsがキャンバスを作成するHTML要素（この場合は`<div>`）。

### 3. p5.jsの基本構造 (`sketch`関数)

`sketch`関数の中に、p5.jsの主要なロジックを記述します。

```typescript
// src/routes/+page.svelte
const sketch = (p: any) => {
  // ここに変数を定義できる

  p.setup = function() {
    // 初期設定を一度だけ行う
  };

  p.draw = function() {
    // フレームごとに繰り返し描画する
  };
};
```

#### `setup()`関数
- キャンバスの作成、初期色の設定、フレームレートの指定など、最初に一度だけ実行したい処理を書きます。
- `p.createCanvas(width, height)`: 描画領域（キャンバス）を作成します。

#### `draw()`関数
- `setup()`の後に繰り返し実行されます（デフォルトでは毎秒60回）。
- `p.background(color)`: キャンバスの背景を塗りつぶします。
- 図形を描いたり、色を変えたり、アニメーションのロジックは主にここに書きます。

### 4. `+page.svelte`での具体的な描画処理

このプロジェクトでは、`draw()`関数内でQRコードを格子状に描画しています。

```typescript
// src/routes/+page.svelte の sketch 関数内
p.draw = function() {
  p.background(255); // 背景を白に
  if (qrData) {
    const modules = qrData.modules;
    for (let y = 0; y < modules; y++) {
      for (let x = 0; x < modules; x++) {
        if (qrData.qr.isDark(y, x)) {
          p.fill(0); // QRコードの黒い部分
        } else {
          p.fill(255); // 白い部分
        }
        p.noStroke(); // 枠線なし
        p.rect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }
  }
  // ... テキスト描画処理
};
```
- `qrData.qr.isDark(y, x)`: `qrcode-generator`で生成したQRコードのデータに基づき、そのセルが黒かどうかを判定します。
- `p.fill(color)`: これ以降に描画される図形の色を設定します。
- `p.rect(x, y, width, height)`: 長方形を描画します。

### 5. クリーンアップ処理

Svelteコンポーネントが破棄されるとき、p5.jsのインスタンスも明示的に削除する必要があります。これにより、メモリリークを防ぎます。

```typescript
// src/routes/+page.svelte の onMount 内
onMount(() => {
  // ...
  return () => { // クリーンアップ関数
    if (p5Instance) {
      p5Instance.remove();
    }
  };
});
```
- `onMount`から返された関数は、コンポーネントが破棄されるときに自動的に実行されます。
- `p5Instance.remove()`: p5.jsが作成したキャンバスや関連するイベントリスナーをすべて削除します。
