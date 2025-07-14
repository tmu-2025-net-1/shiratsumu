<script lang="ts">
  import { onMount } from 'svelte';
  import p5 from 'p5';

  /** server load (+page.server.ts) から渡ってくるデータ */
  export let data: {
    img:   string;   // 画像 URL
    alt:   string;   // 代替テキスト
    q:     string;   // 検索キーワード
    // chars: string;   // ASCII 用文字セット
  };

  let container: HTMLDivElement;

  onMount(() => {
    /** p5 インスタンスを生成 */
    new p5((sk) => {
      let srcImg: p5.Image;
      let cell: number;                // 1 文字のピクセルサイズ（動的計算）
      let table  = [...data.q];       // 文字配列（UTF-16 safe）
      
      // 目標分割数
      const TARGET_COLS = 72;
      const TARGET_ROWS = 48;

      /* ---------- 初期化 ------------- */
      sk.setup = async () => {
        sk.createCanvas(sk.windowWidth, sk.windowHeight).parent(container);
        sk.noStroke();
        sk.noLoop();                    // draw() は手動で再実行
        
        /* 画像を非同期で読み込み */
        try {
          srcImg = await sk.loadImage(data.img);
          
          // 画像サイズから cell サイズを計算
          const cellX = srcImg.width / TARGET_COLS;
          const cellY = srcImg.height / TARGET_ROWS;
          // アスペクト比を考慮して、より大きい方を採用（文字が潰れないように）
          cell = Math.max(cellX, cellY);
          
          // フォントサイズを cell サイズに合わせて設定
          sk.textFont('monospace', cell);
          
          renderAscii(); // 画像読み込み完了後に描画
        } catch (error) {
          console.error('画像の読み込みに失敗しました:', error);
        }
      };

      /* ---------- 描画本体 ----------- */
      function renderAscii() {
        // 画像が読み込まれていない場合は何もしない
        if (!srcImg) return;
        
        sk.clear();

        /* 背景を黒にすると文字が見やすい。好みで変更 */
        sk.background(0);

        /* アスペクト比を保持したまま画像をキャンバスにフィット */
        const scl   = Math.min(sk.width / srcImg.width, sk.height / srcImg.height);
        const imgW  = srcImg.width  * scl;
        const imgH  = srcImg.height * scl;
        const offX  = (sk.width  - imgW) / 2;
        const offY  = (sk.height - imgH) / 2;

        // 画像情報とセル情報をログ出力
        const cellsX = Math.floor(srcImg.width / cell);
        const cellsY = Math.floor(srcImg.height / cell);
        
        console.log('=== ASCII Art Generation Info ===');
        console.log('Original Image Size:', srcImg.width + 'x' + srcImg.height + 'px');
        console.log('Scaled Image Size:', Math.round(imgW) + 'x' + Math.round(imgH) + 'px');
        console.log('Cell Size:', cell + 'px');
        console.log('Grid Size:', cellsX + 'x' + cellsY + ' cells');
        console.log('Total Characters:', cellsX * cellsY);
        console.log('Scale Factor:', scl.toFixed(3));
        console.log('Character Set:', table.join(''));
        console.log('Character Set Length:', table.length);
        console.log('==================================');

        sk.push();
        sk.translate(offX, offY);
        sk.scale(scl);

        /* ピクセル走査して文字を描く */
        srcImg.loadPixels();
        for (let y = 0; y < srcImg.height; y += cell) {
          for (let x = 0; x < srcImg.width; x += cell) {
            const [r, g, b] = srcImg.get(x, y);     // RGB 取得
            const lum = (r + g + b) / 3;            // 明度 (0-255)

            /* 明度→文字インデックス（暗→後ろ、明→前） */
            const idx = sk.floor(sk.map(lum, 0, 255, table.length - 1, 0));
            const ch  = table[idx] ?? table[0];

            /* 文字色をグレースケールで設定（invert したければ 255-lum） */
            sk.fill(lum);
            sk.text(ch, x, y + cell);
          }
        }
        sk.pop();
      }

      /* 初回とリサイズ時に描画 */
      sk.draw = () => {
        // 画像が読み込まれていれば描画
        if (srcImg) renderAscii();
      };
      sk.windowResized = () => {
        sk.resizeCanvas(sk.windowWidth, sk.windowHeight);
        if (srcImg) renderAscii();
      };
    });
  });
</script>

<!-- p5 のキャンバスを挿入するラッパー -->
<div bind:this={container} class="wrapper" aria-label={data.alt}></div>

<style>
  /* 画面いっぱいに広げる —— body リセット込み */
  :global(html), :global(body), .wrapper {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100vh;
    background: #000;   /* ロード中の背景色 */
    overflow: hidden;
  }

  :global(canvas) { display: block; }  /* 余計な隙間を消す */
</style>