<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  
  export let cellSize = 15;
  export let isActive = false;
  export let duration = 4000; // 4秒に変更
  
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let animationId: number;
  let startTime = 0;
  
  // セルのグリッド情報
  let gridCols = 0;
  let gridRows = 0;
  let cells: boolean[][] = []; // true = 黒く塗られている
  let activeCells: {x: number, y: number, birthTime: number}[] = []; // アクティブなセルの情報
  
  $: if (canvas && isActive) {
    initTransition();
  }
  
  function initTransition() {
    if (!canvas) return;
    
    ctx = canvas.getContext('2d')!;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    gridCols = Math.ceil(canvas.width / cellSize);
    gridRows = Math.ceil(canvas.height / cellSize);
    
    // セルの状態を初期化
    cells = Array(gridCols).fill(null).map(() => Array(gridRows).fill(false));
    activeCells = [];
    
    // 中央のセルを最初のアクティブセルとして設定
    const centerX = Math.floor(gridCols / 2);
    const centerY = Math.floor(gridRows / 2);
    activeCells.push({x: centerX, y: centerY, birthTime: 0});
    cells[centerX][centerY] = true;
    
    startTime = Date.now();
    animate();
  }
  
  function animate() {
    if (!ctx || !isActive) return;
    
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // 画面をクリア
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 新しいセルを生成（中央から円形に広がる）
    if (progress < 0.95) { // 95%まで新しいセルを生成
      const newCells: {x: number, y: number, birthTime: number}[] = [];
      
      // 中央座標
      const centerX = Math.floor(gridCols / 2);
      const centerY = Math.floor(gridRows / 2);
      
      // 現在の進行状況に基づいて広がる半径を計算
      const maxRadius = Math.max(centerX, centerY, gridCols - centerX, gridRows - centerY);
      const currentRadius = progress * maxRadius * 1.2; // 1.2倍でゆっくり広がる
      
      // 中央から現在の半径内のセルを段階的に活性化
      for (let x = 0; x < gridCols; x++) {
        for (let y = 0; y < gridRows; y++) {
          if (!cells[x][y]) {
            // 中央からの距離を計算
            const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
            
            // 現在の半径内で、まだ活性化されていないセルを確率的に活性化
            if (distance <= currentRadius) {
              // 距離に基づいた活性化確率（中央に近いほど高い確率）
              const distanceRatio = Math.max(0, 1 - (distance / currentRadius));
              const activationProbability = 0.1 + (distanceRatio * 0.3); // 0.1から0.4の確率
              
              if (Math.random() < activationProbability) {
                cells[x][y] = true;
                newCells.push({
                  x: x,
                  y: y,
                  birthTime: elapsed
                });
              }
            }
          }
        }
      }
      
      // 新しいアクティブセルを追加
      activeCells.push(...newCells);
      
      // 古いアクティブセルを削除（寿命管理）
      const maxAge = 1000; // 1秒の寿命
      activeCells = activeCells.filter(cell => elapsed - cell.birthTime < maxAge);
    } else if (progress >= 0.95) {
      // 95%以降は残りのセルを埋める
      const fillProgress = (progress - 0.95) * 20; // 0から1に正規化
      for (let x = 0; x < gridCols; x++) {
        for (let y = 0; y < gridRows; y++) {
          if (!cells[x][y] && Math.random() < fillProgress * 0.05) {
            cells[x][y] = true;
          }
        }
      }
    }
    
    // すべてのアクティブなセルを描画
    ctx.fillStyle = '#000000';
    
    for (let x = 0; x < gridCols; x++) {
      for (let y = 0; y < gridRows; y++) {
        if (cells[x][y]) {
          const pixelX = x * cellSize;
          const pixelY = y * cellSize;
          ctx.fillRect(pixelX, pixelY, cellSize, cellSize);
        }
      }
    }
    
    // 95%以上の進行度で全面黒塗りを強制実行（確実に画面を埋めるため）
    if (progress >= 0.95) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    // アニメーション完了の判定を時間ベースに変更
    if (progress >= 1) {
      // アニメーション完了時に確実に全面を黒で塗りつぶす
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // 少し待ってからcompleteイベントを発火（全面黒の状態を確実に表示）
      setTimeout(() => {
        dispatch('complete');
      }, 100); // 100ms待機
    } else {
      animationId = requestAnimationFrame(animate);
    }
  }
  
  function stopTransition() {
    if (animationId) {
      cancelAnimationFrame(animationId);
    }
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    // 状態をリセット
    activeCells = [];
    cells = [];
  }
  
  // コンポーネントが破棄される時にアニメーションを停止
  import { onDestroy } from 'svelte';
  onDestroy(() => {
    stopTransition();
  });
</script>

<div class="transition-overlay" class:active={isActive}>
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  .transition-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 9999;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.1s;
  }
  
  .transition-overlay.active {
    opacity: 1;
    pointer-events: auto;
  }
  
  canvas {
    width: 100%;
    height: 100%;
    display: block;
  }
</style>
