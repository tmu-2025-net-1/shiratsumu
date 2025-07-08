## `qrcode-generator` ライブラリ利用マニュアル

このマニュアルは、`src/routes/+page.svelte`で使用されている`qrcode-generator`ライブラリの使い方と、`+page.svelte`内での具体的な役割について解説します。

### 1. qrcode-generatorとは？

`qrcode-generator`は、テキストデータからQRコードを生成するためのJavaScriptライブラリです。QRコードを構成する一つ一つのセル（モジュール）が黒か白かを計算する機能を提供します。

このプロジェクトでは、このライブラリで計算されたQRコードの設計図を元に、p5.jsを使って実際に画面に描画しています。

### 2. `+page.svelte`での基本的な使い方

QRコードの生成は、ユーザーがテキストを入力したり、設定を変更したりするたびに`generateQrCode`関数内で実行されます。

**コード内の該当箇所:**
```typescript
// src/routes/+page.svelte
function generateQrCode() {
  if (!qrText) { // 入力テキストが空の場合は何もしない
    qrData = null;
    return;
  }
  try {
    // 1. QRコードオブジェクトを作成
    const qr = qrcode(0, errorCorrectionLevel as 'L' | 'M' | 'Q' | 'H');

    // 2. ユーザーが入力したテキストをデータとして追加
    qr.addData(qrText);

    // 3. QRコードの内部データを生成
    qr.make();

    // 4. 生成されたデータをp5.jsで描画するために保存
    qrData = {
      qr: qr,
      modules: qr.getModuleCount(),
    };
  } catch (e) {
    console.error(e);
    qrData = null;
  }
}
```

--- 

### 3. 各ステップの詳細

#### `qrcode(typeNumber, errorCorrectionLevel)`

QRコードオブジェクトを初期化します。

- **`typeNumber`**: QRコードのバージョン（サイズ）を指定します。`0`を渡すと、入力されたデータの量に応じてライブラリが自動的に最適なサイズを選んでくれます。
- **`errorCorrectionLevel` (エラー訂正レベル)**: QRコードの一部が隠れたり汚れたりしても読み取れるようにするための設定です。レベルが高いほど、多くの破損に耐えられますが、QRコードの密度も高くなります。
    - `'L'` (Low): 約7%まで復元可能
    - `'M'` (Medium): 約15%まで復元可能
    - `'Q'` (Quartile): 約25%まで復元可能
    - `'H'` (High): 約30%まで復元可能

  **該当箇所**: `const qr = qrcode(0, errorCorrectionLevel ...);`
  **解説**: SvelteのUIでユーザーが選択したエラー訂正レベル（`errorCorrectionLevel`変数）を使ってQRコードオブジェクトを作成しています。

#### `qr.addData(text)`

QRコードに変換したいテキストデータを渡します。

  **該当箇所**: `qr.addData(qrText);`
  **解説**: ユーザーがテキストエリアに入力した文字列（`qrText`変数）をQRコードの元データとして設定しています。

#### `qr.make()`

`addData`で追加されたデータに基づき、QRコードのパターンを内部的に計算します。このステップを経て、初めて各セルの色情報などを取得できるようになります。

### 4. 生成されたデータの活用 (p5.jsとの連携)

`make()`を実行した後、以下の関数を使ってp5.jsでの描画に必要な情報を取得します。

- **`qr.getModuleCount()`**: QRコードの一辺のセルの数を返します。例えば、21x21のQRコードなら`21`が返されます。これはp5.jsで描画する際のグリッドのサイズを決めるのに使われます。

- **`qr.isDark(row, col)`**: 指定した行（`row`）と列（`col`）のセルが黒（Dark）であるべきかを判定します。黒なら`true`、白なら`false`を返します。

**p5.jsでの利用箇所:**
```typescript
// src/routes/+page.svelte の sketch 関数内
p.draw = function() {
  // ...
  if (qrData.qr.isDark(y, x)) { // isDarkでセルの色を判定
    p.fill(0); // 黒の場合
  } else {
    p.fill(255); // 白の場合
  }
  p.rect(x * cellSize, y * cellSize, cellSize, cellSize);
  // ...
};
```

このように、`qrcode-generator`が計算した設計図（`isDark`の結果）を元に、p5.jsが一つ一つのセルを画面に描画していくことで、最終的なQRコードアートが完成します。
