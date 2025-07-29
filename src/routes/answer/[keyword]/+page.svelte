<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { doc, runTransaction } from 'firebase/firestore';
  import { db } from '$lib/firebase';

  // サーバー(load関数)から渡されるデータを受け取る
  export let data: {
    img: string;
    altText: string;
    q: string; // keyword
    chars: string;
    sessionId: string | null;
  };

  let container: HTMLDivElement;
  let statusMessage = "p5.jsを準備中です...";

  // ページの状態を管理する変数
  let answerText = data.q;
  let isProcessing = false;
  let hasProcessedTurn = false; // ターン処理が実行済みかを管理するフラグ

  // p5.jsの描画関連の変数
  let cellSize = 10;
  let textX = 0;
  let textY = 0;

  // 次のターンに進むメインの処理
  async function processNextTurn() {
    // 処理中、または処理済み、またはセッションIDがない場合は何もしない
    if (isProcessing || hasProcessedTurn || !data.sessionId) return;
    
    isProcessing = true;
    hasProcessedTurn = true; // 処理の開始を記録し、二重実行を防ぐ
    statusMessage = "次の単語を考えています...";
    
    try {
      // 1. Gemini APIを呼び出す
      const lastChar = answerText.charAt(answerText.length - 1);
      const response = await fetch('/api/shiritori/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastCharacter: lastChar })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API failed: ${errorData.details || response.status}`);
      }
      const responseData = await response.json();
      const geminiAnswer = responseData.answer;
      console.log('Gemini回答:', geminiAnswer);

      // 2. Firestoreに記録する
      statusMessage = "回答を記録しています...";
      const sessionRef = doc(db, 'sessions', data.sessionId);
      await runTransaction(db, async (transaction) => {
        const sessionDoc = await transaction.get(sessionRef);
        if (!sessionDoc.exists()) throw new Error('セッションが見つかりません');

        const currentData = sessionDoc.data();
        const conversation = currentData.conversation || [];
        const targetMessageId = conversation.length + 1;
        
        const newMessage = {
          id: targetMessageId,
          sender: "ai",
          text: geminiAnswer,
          updatedAt: new Date()
        };
        
        conversation.push(newMessage);
        transaction.update(sessionRef, { 
          conversation: conversation,
          keyword: geminiAnswer, 
          updatedAt: new Date()
        });
      });

      console.log('AI回答をFirestoreに記録完了');
      statusMessage = "次のページへ移動します...";

      // 3. createページに遷移
      goto(`/create?sessionId=${data.sessionId}`);

    } catch (error) {
      console.error('次のターンへの処理でエラーが発生しました:', error);
      statusMessage = `エラー: ${error instanceof Error ? error.message : 'Unknown error'}`;
      isProcessing = false;
      hasProcessedTurn = false; // エラー時は再試行を許可
    }
  }

  onMount(() => {
    import('p5').then(p5Module => {
      const p5 = p5Module.default;
      const sketch = (sk: any) => {
        let srcImg: any;

        sk.setup = () => {
          sk.createCanvas(sk.windowWidth, sk.windowHeight).parent(container);
          sk.background(0);
          statusMessage = "画像データを読み込んでいます...";
          
          sk.loadImage(data.img, (loadedImg: any) => {
            srcImg = loadedImg;
            statusMessage = "ASCIIアートが完成しました！";
            console.log("Image rendering successful!");

            // 描画を実行
            sk.redraw(); 
            
            // 描画完了後、10秒待ってから次のターンの処理を開始する
            statusMessage = "10秒後に次の単語へ進みます...";
            setTimeout(() => {
              processNextTurn();
            }, 10000); // 10秒の待機時間

          }, (err: any) => {
            console.error("Failed to load image:", err);
            statusMessage = `画像の読み込みに失敗: ${data.img}`;
          });

          sk.noLoop(); // 描画は手動(redraw)で行う
        };

        sk.draw = () => {
          sk.background(0);
          if (srcImg) {
            renderAscii(sk, srcImg);
          } else {
            sk.fill(255);
            sk.textAlign(sk.CENTER, sk.CENTER);
            sk.textSize(20);
            sk.text(statusMessage, sk.width / 2, sk.height / 2);
          }
        };
        
        function renderAscii(sk: any, srcImg: any) {
          const asciiChars = data.chars;
          const table = [...asciiChars];
          
          sk.textFont('monospace', cellSize);
          sk.textAlign(sk.LEFT, sk.TOP); // text()の基準点を左上に変更
          
          const scale = Math.min(sk.width / srcImg.width, sk.height / srcImg.height);
          const displayWidth = srcImg.width * scale;
          const displayHeight = srcImg.height * scale;
          const offsetX = (sk.width - displayWidth) / 2;
          const offsetY = (sk.height - displayHeight) / 2;
          
          sk.push();
          sk.translate(offsetX, offsetY);
          sk.scale(scale);
          
          srcImg.loadPixels();
          
          const TARGET_COLS = 72;
          const TARGET_ROWS = 48;
          const cellX = srcImg.width / TARGET_COLS;
          const cellY = srcImg.height / TARGET_ROWS;
          cellSize = Math.max(cellX, cellY);
          
          const actualCols = Math.floor(srcImg.width / cellSize);
          const actualRows = Math.floor(srcImg.height / cellSize);
          const randomCol = sk.floor(sk.random(Math.max(1, actualCols - answerText.length)));
          const randomRow = sk.floor(sk.random(Math.max(1, actualRows - 1)));
          textX = randomCol * cellSize;
          textY = randomRow * cellSize;

          for (let y = 0; y < srcImg.height; y += cellSize) {
            for (let x = 0; x < srcImg.width; x += cellSize) {
              const isTextArea = isInTextArea(x, y);
              
              if (isTextArea) {
                const charIndex = Math.floor((x - textX) / cellSize);
                const char = answerText[charIndex];
                if (char && char.trim() !== '') {
                  sk.fill(255, 255, 255);
                  sk.text(char, x, y);
                }
              } else {
                const [r, g, b] = srcImg.get(x, y);
                const lum = (r + g + b) / 3;
                const idx = sk.floor(sk.map(lum, 0, 255, table.length - 1, 0));
                const ch = table[idx] ?? table[0];
                sk.fill(lum);
                sk.text(ch, x, y);
              }
            }
          }
          sk.pop();
        }
        
        function isInTextArea(x: number, y: number): boolean {
          const gridCol = Math.floor(x / cellSize);
          const gridRow = Math.floor(y / cellSize);
          const textStartCol = Math.floor(textX / cellSize);
          const textStartRow = Math.floor(textY / cellSize);
          
          return gridRow === textStartRow && 
                 gridCol >= textStartCol && 
                 gridCol < textStartCol + answerText.length;
        }

        sk.windowResized = () => {
          sk.resizeCanvas(sk.windowWidth, sk.windowHeight);
          sk.redraw();
        };
      };
      new p5(sketch);
    }).catch(err => {
      statusMessage = "p5.jsの読み込みに失敗しました。";
    });
  });
</script>

<div bind:this={container} aria-label={data.altText}></div>

<div class="debug-info">
  <p>Session ID: {data.sessionId || 'なし'}</p>
  <p>Status: {statusMessage}</p>
  <p>Processing: {isProcessing ? 'Yes' : 'No'}</p>
</div>

<style>
  :global(html), :global(body) {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100vh;
    background: #000;
    overflow: hidden;
  }
  
  :global(canvas) { 
    display: block;
  }
  
  .debug-info {
    position: fixed;
    bottom: 10px;
    left: 10px;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 8px;
    border-radius: 4px;
    font-family: monospace;
    z-index: 1000;
    font-size: 10px;
    opacity: 0.6;
  }
  
  .debug-info p {
    margin: 2px 0;
    word-break: break-all;
  }
</style>