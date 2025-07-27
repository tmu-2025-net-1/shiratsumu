<script lang="ts">
  import { onMount } from 'svelte';

  // サーバーから渡される「平坦な」データ構造を正しく定義
  export let data: {
    imgUrl: string;
    altText: string;
  };

  export const ssr = false;

  let container: HTMLDivElement;
  let statusMessage = "p5.jsを準備中...";

  onMount(() => {
    statusMessage = "p5.jsを読み込んでいます...";
    import('p5').then(p5Module => {
      statusMessage = "画像データを読み込んでいます...";
      const p5 = p5Module.default || p5Module;

      const sketch = (sk: any) => {
        let testImg: any;

        sk.setup = async () => {
          sk.createCanvas(400, 400).parent(container);
          statusMessage = "画像データを読み込んでいます...";
          
          // p5.js 2.0では async/await で画像を読み込む
          try {
            testImg = await sk.loadImage(data.imgUrl);
            statusMessage = "描画が成功しました！";
            console.log("画像描画成功！");
            sk.image(testImg, 0, 0, 400, 400);
          } catch (e) {
            console.error("画像の読み込みに失敗しました:", e);
            statusMessage = `画像の読み込みに失敗: ${data.imgUrl}`;
          }
        };
      };

      new p5(sketch);
    
    }).catch(err => {
      console.error("p5の動的インポートに失敗しました:", err);
      statusMessage = "p5.jsの読み込みに失敗しました。";
    });
  });
</script>

<h1>p5.js データ連携テスト</h1>
<p>{statusMessage}</p>

<div bind:this={container} aria-label={data.altText}></div>