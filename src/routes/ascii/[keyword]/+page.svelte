<script lang="ts">
  import { onMount } from 'svelte';

  export let data: {
    img: string;
    alt: string;
    q: string;
    chars: string;
  };

  let container: HTMLDivElement;

  onMount(() => {
    import('p5').then(p5Module => {
      const p5 = p5Module.default || p5Module;
      new p5((sk: any) => {
        let srcImg: any;

        sk.setup = async () => {
          sk.createCanvas(sk.windowWidth, sk.windowHeight).parent(container);
          sk.noLoop();
          
          // p5.js 2.0では async/await で画像を読み込む
          try {
            srcImg = await sk.loadImage(data.img);
            renderAscii();
          } catch (e) {
            console.error("画像の読み込みに失敗:", e);
          }
        };

        // ここにあなたのASCIIアート描画関数を復活させる
        function renderAscii() {
          let cell: number;
          const table = [...data.chars];
          const TARGET_COLS = 72;
          const TARGET_ROWS = 48;
          
          const cellX = srcImg.width / TARGET_COLS;
          const cellY = srcImg.height / TARGET_ROWS;
          cell = Math.max(cellX, cellY);
          
          sk.textFont('monospace', cell);
          sk.background(0);
          
          const scl = Math.min(sk.width / srcImg.width, sk.height / srcImg.height);
          const offX = (sk.width - (srcImg.width * scl)) / 2;
          const offY = (sk.height - (srcImg.height * scl)) / 2;

          sk.push();
          sk.translate(offX, offY);
          sk.scale(scl);

          srcImg.loadPixels();
          for (let y = 0; y < srcImg.height; y += cell) {
            for (let x = 0; x < srcImg.width; x += cell) {
              const [r, g, b] = srcImg.get(x, y);
              const lum = (r + g + b) / 3;
              const idx = sk.floor(sk.map(lum, 0, 255, table.length - 1, 0));
              const ch  = table[idx] ?? table[0];
              sk.fill(lum);
              sk.text(ch, x, y + cell);
            }
          }
          sk.pop();
        }

        sk.windowResized = () => {
          sk.resizeCanvas(sk.windowWidth, sk.windowHeight);
          if (srcImg) renderAscii();
        };
      });
    });
  });
</script>

<div bind:this={container} aria-label={data.alt}></div>

<style>
  :global(html), :global(body) {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100vh;
    background: #000;
    overflow: hidden;
  }
  :global(canvas) { display: block; }
</style>