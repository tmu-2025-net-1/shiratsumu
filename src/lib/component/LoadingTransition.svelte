<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { browser } from '$app/environment';

  export let cellSize = 15;
  export let isActive = false;
  export let duration = 3000; // デフォルト3秒
  export let loadingText = 'loading'; // 表示する文字列
  export let isMini = false; // ミニバージョンのフラグ
  export let miniSize = 80; // ミニバージョンの円のサイズ

  const dispatch = createEventDispatcher();

  let canvasElement: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let animationId: number;
  let startTime = 0;
  let isAnimating = false;
  let canvasReady = false;

  // グリッドデータ
  let grid: Array<Array<{
    char: string;
    alpha: number;
    revealed: boolean;
    revealTime: number;
  }>> = [];
  let gridCols = 0;
  let gridRows = 0;

  // ミニバージョン用のデータ
  let miniChars: Array<{
    char: string;
    angle: number;
    radius: number;
    alpha: number;
    waveOffset: number;
  }> = [];

  onMount(() => {
    if (!browser) return;

    ctx = canvasElement.getContext('2d');
    if (!ctx) return;

    setupCanvas();
    canvasReady = true;
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  });

  function setupCanvas() {
    if (!canvasElement || !ctx) return;

    // ミニバージョンでも通常バージョンでも全画面サイズを使用
    canvasElement.width = window.innerWidth;
    canvasElement.height = window.innerHeight;

    if (isMini) {
      initMiniChars();
    } else {
      initGrid();
    }
  }

  function initGrid() {
    if (!ctx) return;

    // 画面幅を目標セル数で割ってセルサイズを計算
    const TARGET_COLS = 72;
    const dynamicCellSize = canvasElement.width / TARGET_COLS;
    cellSize = dynamicCellSize; // セルサイズを動的に更新

    gridCols = Math.ceil(canvasElement.width / cellSize);
    gridRows = Math.ceil(canvasElement.height / cellSize);

    grid = [];
    for (let x = 0; x < gridCols; x++) {
      grid[x] = [];
      for (let y = 0; y < gridRows; y++) {
        // 初期状態では全て透明
        grid[x][y] = {
          char: getRandomChar(),
          alpha: 0,
          revealed: false,
          revealTime: 0
        };
      }
    }
  }

  function initMiniChars() {
    miniChars = [];
    const radius = miniSize / 2 - 20; // 円の半径を少し小さく
    const charCount = loadingText.length;
    
    for (let i = 0; i < charCount; i++) {
      const angle = (i / charCount) * Math.PI * 2;
      miniChars.push({
        char: loadingText[i],
        angle: angle,
        radius: radius,
        alpha: 1, // 初期状態で表示
        waveOffset: Math.random() * Math.PI * 2
      });
    }
  }

  function getRandomChar(): string {
    const charIndex = Math.floor(Math.random() * loadingText.length);
    return loadingText[charIndex];
  }

  function handleResize() {
    setupCanvas();
  }

  function startAnimation() {
    if (isAnimating) return;

    isAnimating = true;
    startTime = performance.now();

    // キャンバスを初期化（ミニバージョンの場合は透明、通常は黒）
    if (ctx) {
      ctx.fillStyle = isMini ? 'rgba(0, 0, 0, 0)' : 'rgba(0, 0, 0, 1)';
      ctx.fillRect(0, 0, canvasElement.width, canvasElement.height);
    }

    if (isMini) {
      // ミニバージョンの場合はシンプルに開始
      // 文字は既に初期化時に設定済み
    } else {
      // 通常バージョンの処理
      const centerX = Math.floor(gridCols / 2);
      const centerY = Math.floor(gridRows / 2);

      for (let x = 0; x < gridCols; x++) {
        for (let y = 0; y < gridRows; y++) {
          const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
          grid[x][y].revealTime = distance * 50;
          grid[x][y].char = getRandomChar();
        }
      }
    }

    animate();
  }

  function animate() {
    if (!ctx || !isAnimating) return;

    const currentTime = performance.now() - startTime;
    const progress = Math.min(currentTime / duration, 1);

    if (isMini) {
      // ミニバージョンの場合、トレイル効果のために半透明の背景を重ねる
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(0, 0, canvasElement.width, canvasElement.height);
      animateMini(currentTime);
    } else {
      // 通常バージョンは完全にクリア
      ctx.fillStyle = 'rgba(0, 0, 0, 1)';
      ctx.fillRect(0, 0, canvasElement.width, canvasElement.height);
      animateGrid(currentTime, progress);
    }

    if (progress < 1) {
      animationId = requestAnimationFrame(animate);
    } else {
      finishAnimation();
    }
  }

  function animateMini(currentTime: number) {
    if (!ctx) return;

    // 画面中央を正確に計算
    const centerX = canvasElement.width / 2;
    const centerY = canvasElement.height / 2;

    // パルス効果とフェード効果
    const pulseSpeed = 0.003;
    const fadeSpeed = 0.002;
    const pulse = Math.sin(currentTime * pulseSpeed) * 0.2 + 0.8;
    const fade = Math.sin(currentTime * fadeSpeed) * 0.3 + 0.5;

    // グレーの円形を描画（パルス効果付き）
    const radius = (miniSize / 2) * pulse;
    
    // 外側の円（より薄いグレー）
    ctx.strokeStyle = `rgba(128, 128, 128, ${0.3 * fade})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();

    // 内側の円（少し濃いグレー）
    ctx.strokeStyle = `rgba(128, 128, 128, ${0.5 * fade})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.7, 0, Math.PI * 2);
    ctx.stroke();

    // 中心点（小さな点）
    ctx.fillStyle = `rgba(128, 128, 128, ${0.7 * fade})`;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 2 * pulse, 0, Math.PI * 2);
    ctx.fill();
  }

  function animateGrid(currentTime: number, progress: number) {
    if (!ctx) return;

    // フォント設定
    ctx.font = `${cellSize}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // グリッドを描画
    for (let x = 0; x < gridCols; x++) {
      for (let y = 0; y < gridRows; y++) {
        const cell = grid[x][y];
        
        // セルが表示されるタイミングかチェック
        if (currentTime >= cell.revealTime && !cell.revealed) {
          cell.revealed = true;
          cell.alpha = 1;
          // 表示時に新しい文字を再ランダム化
          cell.char = getRandomChar();
        }

        // 表示されたセルを描画
        if (cell.revealed) {
          // アニメーション終了に向けてフェードアウト
          if (progress > 0.7) {
            const fadeProgress = (progress - 0.7) / 0.3;
            cell.alpha = 1 - fadeProgress;
          }

          if (cell.alpha > 0) {
            const pixelX = x * cellSize + cellSize / 2;
            const pixelY = y * cellSize + cellSize / 2;

            // 黒から白にかけてのランダムな色を生成
            const randomBrightness = Math.floor(Math.random() * 256);
            ctx.fillStyle = `rgba(${randomBrightness}, ${randomBrightness}, ${randomBrightness}, ${cell.alpha})`;
            ctx.fillText(cell.char, pixelX, pixelY);
          }
        }
      }
    }
  }

  function finishAnimation() {
    isAnimating = false;
    if (animationId) {
      cancelAnimationFrame(animationId);
    }
    
    // アニメーション完了時にリセット（通常バージョンのみ）
    if (!isMini && miniChars.length > 0) {
      miniChars.forEach(char => {
        char.alpha = 0;
      });
    }
    
    dispatch('complete');
  }

  // isActiveが変更されたときにアニメーションを開始
  $: if (isActive && browser && canvasReady && ctx !== null) {
    if (!isMini) {
      // 通常バージョンのみ文字を初期化
      initMiniChars();
    }
    startAnimation();
  }

  // isActiveがfalseになったときにアニメーションを停止
  $: if (!isActive && isAnimating) {
    finishAnimation();
  }
</script>

{#if isActive}
  <div class="loading-transition" data-mini={isMini}>
    <canvas
      bind:this={canvasElement}
      class="loading-canvas"
    ></canvas>
  </div>
{/if}

<style>
  .loading-transition {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 9999;
    pointer-events: none;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .loading-canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
  
  /* ミニバージョン用のスタイル */
  .loading-transition[data-mini="true"] .loading-canvas {
    /* ミニバージョンでも全画面キャンバスを使用 */
    width: 100%;
    height: 100%;
  }
</style>
