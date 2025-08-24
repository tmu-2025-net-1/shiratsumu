<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { doc, runTransaction, getDoc } from 'firebase/firestore';
  import { db } from '$lib/firebase';
  import LoadingTransition from '$lib/component/LoadingTransition.svelte';

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
  let p5Instance: any = null; // p5インスタンスの参照を保持
  let isCleanupAnimating = false; // クリーンアップアニメーション中かどうか
  let cleanupProgress = 0; // クリーンアップの進行度 (0-1)

  // ローディングトランジション用の変数
  let isInitialLoading = true; // 画像表示前の大きいローディング
  let isMiniLoading = false; // 処理中のミニローディング
  let isTransitionLoading = false; // ページ遷移前のミニローディング
  let loadingCellSize = 15;
  let miniLoadingStartTime = 0; // ミニローディング開始時間
  const MINI_LOADING_MIN_DURATION = 3000; // ミニローディングの最低表示時間（3秒）
  const TRANSITION_LOADING_DURATION = 3000; // ページ遷移前のローディング時間（3秒）

  // ローディング完了時の処理
  function handleInitialLoadingComplete() {
    isInitialLoading = false;
    console.log('初期ローディングトランジション完了');
  }

  function handleMiniLoadingComplete() {
    isMiniLoading = false;
    console.log('ミニローディングトランジション完了');
  }

  function handleTransitionLoadingComplete() {
    isTransitionLoading = false;
    console.log('遷移ローディングトランジション完了');
    console.log('Session ID:', data.sessionId);
    
    // sessionIdの存在確認
    if (!data.sessionId) {
      console.error('sessionIdが存在しないため、createページに遷移できません');
      statusMessage = "エラー: セッションIDが見つかりません";
      return;
    }
    
    try {
      // 遷移ローディング完了後にcreateページに移動
      console.log('createページに遷移中...');
      goto(`/create?sessionId=${data.sessionId}`);
    } catch (error) {
      console.error('ページ遷移でエラーが発生しました:', error);
      statusMessage = `ページ遷移エラー: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  // ミニローディングを最低時間確保して停止する関数
  function stopMiniLoadingWithMinTime() {
    const elapsedTime = Date.now() - miniLoadingStartTime;
    const remainingTime = Math.max(0, MINI_LOADING_MIN_DURATION - elapsedTime);
    
    if (remainingTime > 0) {
      // 最低時間に達していない場合は待機してから停止
      setTimeout(() => {
        isMiniLoading = false;
      }, remainingTime);
    } else {
      // 既に最低時間が経過している場合は即座に停止
      isMiniLoading = false;
    }
  }

  // ミニローディングを最低時間確保して停止する関数（Promise版）
  function stopMiniLoadingWithMinTimeAsync(): Promise<void> {
    return new Promise((resolve) => {
      const elapsedTime = Date.now() - miniLoadingStartTime;
      const remainingTime = Math.max(0, MINI_LOADING_MIN_DURATION - elapsedTime);
      
      console.log('ミニローディング停止処理:', { elapsedTime, remainingTime });
      
      if (remainingTime > 0) {
        // 最低時間に達していない場合は待機してから停止
        setTimeout(() => {
          isMiniLoading = false;
          console.log('ミニローディング停止完了（待機後）');
          resolve();
        }, remainingTime);
      } else {
        // 既に最低時間が経過している場合は即座に停止
        isMiniLoading = false;
        console.log('ミニローディング停止完了（即座）');
        resolve();
      }
    });
  }

  // p5インスタンスのクリーンアップアニメーション
  function startCleanupAnimation() {
    if (!p5Instance || isCleanupAnimating) return;
    
    isCleanupAnimating = true;
    cleanupProgress = 0;
    statusMessage = "次の単語へ移行中...";
    
    // p5のループを再開してアニメーションを実行
    if (p5Instance.canvas) {
      p5Instance.loop();
    }
    
    const animationDuration = 2000; // 2秒でアニメーション
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      cleanupProgress = Math.min(elapsed / animationDuration, 1);
      
      if (cleanupProgress < 1) {
        requestAnimationFrame(animate);
      } else {
        // アニメーション完了後にp5インスタンスを破棄
        if (p5Instance) {
          p5Instance.remove();
          p5Instance = null;
          console.log('p5インスタンスを破棄しました');
        }
        isCleanupAnimating = false;
        
        // ミニローディングを開始
        isMiniLoading = true;
        miniLoadingStartTime = Date.now();
        statusMessage = "次の単語を考えています...";
      }
    };
    
    animate();
  }
  

  // 次のターンに進むメインの処理
  async function processNextTurn() {
    console.log('processNextTurn開始');
    console.log('isProcessing:', isProcessing, 'hasProcessedTurn:', hasProcessedTurn, 'sessionId:', data.sessionId);
    
    // 処理中、または処理済み、またはセッションIDがない場合は何もしない
    if (isProcessing || hasProcessedTurn || !data.sessionId) {
      console.log('processNextTurnスキップ - 条件不一致');
      return;
    }
    
    isProcessing = true;
    hasProcessedTurn = true; // 処理の開始を記録し、二重実行を防ぐ
    console.log('processNextTurn実行開始');
    
    // クリーンアップアニメーションを開始
    startCleanupAnimation();
    
    // アニメーション完了まで待機
    await new Promise(resolve => {
      const checkAnimation = () => {
        if (!isCleanupAnimating) {
          resolve(void 0);
        } else {
          setTimeout(checkAnimation, 100);
        }
      };
      checkAnimation();
    });
    
    try {
      // 1. セッションから既に使用された単語を取得
      const usedWordsSessionRef = doc(db, 'sessions', data.sessionId);
      const sessionDoc = await getDoc(usedWordsSessionRef);
      let usedWords: string[] = [];
      

      if (sessionDoc.exists()) {
        const sessionData = sessionDoc.data();
        const conversation = sessionData.conversation || [];
        const lastChar = answerText.charAt(answerText.length - 1).toLowerCase();
        // lastCharacterで始まる単語をconversationから抽出
        usedWords = conversation
          .filter((msg: any) => msg.text && msg.text.toLowerCase().startsWith(lastChar))
          .map((msg: any) => msg.text.toLowerCase());
        console.log('usedWords:', usedWords);
      }

      // 2. Gemini APIを呼び出す（使用済み単語リストも送信）
      const lastChar = answerText.charAt(answerText.length - 1);
      const response = await fetch('/api/shiritori/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastCharacter: lastChar, usedWords: usedWords })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API failed: ${errorData.details || response.status}`);
      }
      const responseData = await response.json();
      const geminiAnswer = responseData.answer;
      console.log('Gemini回答:', geminiAnswer);

      // 2.5. AIの回答で画像を事前取得（Unsplash APIキャッシュ）
      statusMessage = "次の画像を準備しています...";
      let imagePreloadSuccess = false;
      let preloadAttempts = 0;
      const maxRetries = 3;
      const retryDelay = 1000; // 1秒

      const attemptImagePreload = async (): Promise<boolean> => {
        preloadAttempts++;
        console.log(`[processNextTurn] Image preload attempt ${preloadAttempts}/${maxRetries} for: ${geminiAnswer}`);
        
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒タイムアウト

          const preloadResponse = await fetch('/api/preload-image', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({ keyword: geminiAnswer }),
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          console.log(`[processNextTurn] Preload response status: ${preloadResponse.status}`);

          if (preloadResponse.ok) {
            const preloadData = await preloadResponse.json();
            console.log('[processNextTurn] Preload response data:', {
              success: preloadData.success,
              hasImg: !!preloadData.img,
              step: preloadData.step,
              error: preloadData.error
            });

            if (preloadData.success && preloadData.img) {
              console.log(`[processNextTurn] Image preload successful for ${geminiAnswer}:`, {
                url: preloadData.img.substring(0, 100) + '...',
                processingTime: preloadData.metadata?.processingTime
              });
              return true;
            } else {
              console.warn(`[processNextTurn] Preload failed - success: ${preloadData.success}, error: ${preloadData.error}`);
              return false;
            }
          } else {
            let errorDetails = `HTTP ${preloadResponse.status}`;
            try {
              const errorData = await preloadResponse.json();
              errorDetails = errorData.error || errorData.message || errorDetails;
              console.warn(`[processNextTurn] Preload API error:`, {
                status: preloadResponse.status,
                step: errorData.step,
                error: errorDetails
              });
            } catch (e) {
              console.warn(`[processNextTurn] Failed to parse error response: ${errorDetails}`);
            }
            return false;
          }

        } catch (fetchError: any) {
          if (fetchError.name === 'AbortError') {
            console.warn(`[processNextTurn] Image preload timed out for: ${geminiAnswer}`);
          } else {
            console.warn(`[processNextTurn] Image preload network error:`, {
              message: fetchError.message,
              name: fetchError.name
            });
          }
          return false;
        }
      };

      // リトライ機能付きで画像事前取得を実行
      while (!imagePreloadSuccess && preloadAttempts < maxRetries) {
        imagePreloadSuccess = await attemptImagePreload();
        
        if (!imagePreloadSuccess && preloadAttempts < maxRetries) {
          console.log(`[processNextTurn] Retrying in ${retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }

      if (!imagePreloadSuccess) {
        console.error(`[processNextTurn] All ${maxRetries} preload attempts failed for: ${geminiAnswer}`);
        
        // 本番環境では画像取得失敗時も処理を継続（デグレードモード）
        const isProduction = window.location.hostname !== 'localhost';
        if (isProduction) {
          console.warn('[processNextTurn] Production mode: continuing despite image preload failure');
          imagePreloadSuccess = true; // 強制的に処理を継続
        } else {
          throw new Error(`画像の事前取得に${maxRetries}回失敗しました: ${geminiAnswer}`);
        }
      }

      // 3. Firestoreに記録する（画像取得成功後のみ）
      statusMessage = "回答を記録しています...";
      const firestoreSessionRef = doc(db, 'sessions', data.sessionId);
      await runTransaction(db, async (transaction) => {
        const sessionDoc = await transaction.get(firestoreSessionRef);
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
        transaction.update(firestoreSessionRef, { 
          conversation: conversation,
          keyword: geminiAnswer, 
          updatedAt: new Date()
        });
      });

      console.log('AI回答をFirestoreに記録完了');
      statusMessage = "次のページへ移動します...";
      
      // ミニローディングの停止を待ってから遷移ローディングを開始
      await stopMiniLoadingWithMinTimeAsync();
      
      // 遷移前ローディングを開始（少し遅延を入れて自然に切り替え）
      console.log('遷移前ローディング開始準備中...');
      setTimeout(() => {
        console.log('遷移前ローディング開始');
        isTransitionLoading = true;
        
        // フォールバック: 一定時間後に強制的にページ遷移
        setTimeout(() => {
          if (isTransitionLoading) {
            console.warn('遷移ローディングが完了しなかったため、強制的にページ遷移を実行');
            handleTransitionLoadingComplete();
          }
        }, TRANSITION_LOADING_DURATION + 1000); // 設定時間+1秒のバッファ
      }, 500);

    } catch (error) {
      console.error('次のターンへの処理でエラーが発生しました:', error);
      statusMessage = `エラー: ${error instanceof Error ? error.message : 'Unknown error'}`;
      isProcessing = false;
      hasProcessedTurn = false; // エラー時は再試行を許可
      stopMiniLoadingWithMinTime(); // エラー時も最低時間確保してミニローディングを停止
      
      // エラー発生時でもページ遷移を試行（sessionIdがある場合）
      if (data.sessionId) {
        console.log('エラー発生後、フォールバック遷移を実行');
        setTimeout(() => {
          try {
            goto(`/create?sessionId=${data.sessionId}`);
          } catch (gotoError) {
            console.error('フォールバック遷移も失敗:', gotoError);
          }
        }, 2000);
      }
    }
  }

  onMount(() => {
    // ローディング用のセルサイズを画面幅から計算
    const TARGET_COLS = 72;
    loadingCellSize = window.innerWidth / TARGET_COLS;

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

            // 初期ローディングを停止
            isInitialLoading = false;

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
            isInitialLoading = false; // エラー時も初期ローディングを停止
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
          
          // クリーンアップアニメーション中は自動で再描画を停止
          if (isCleanupAnimating && cleanupProgress >= 1) {
            sk.noLoop();
          }
        };
        
        function renderAscii(sk: any, srcImg: any) {
          const asciiChars = data.chars;
          const table = [...asciiChars];
          
          const scale = Math.min(sk.width / srcImg.width, sk.height / srcImg.height);
          const displayWidth = srcImg.width * scale;
          const displayHeight = srcImg.height * scale;
          const offsetX = (sk.width - displayWidth) / 2;
          const offsetY = (sk.height - displayHeight) / 2;
          
          sk.push();
          sk.translate(offsetX, offsetY);
          sk.scale(scale);
          
          srcImg.loadPixels();
          
          const TARGET_COLS = 150; // セルサイズを小さくするために増加
          const TARGET_ROWS = 90;  // セルサイズを小さくするために増加
          const cellX = srcImg.width / TARGET_COLS;
          const cellY = srcImg.height / TARGET_ROWS;
          cellSize = Math.max(cellX, cellY);
          
          // フォントサイズをセルサイズと同じに設定
          sk.textFont('monospace', cellSize);
          sk.textAlign(sk.LEFT, sk.TOP); // text()の基準点を左上に変更
          
          const actualCols = Math.floor(srcImg.width / cellSize);
          const actualRows = Math.floor(srcImg.height / cellSize);
          const randomCol = sk.floor(sk.random(Math.max(1, actualCols - answerText.length)));
          const randomRow = sk.floor(sk.random(Math.max(1, actualRows - 1)));
          textX = randomCol * cellSize;
          textY = randomRow * cellSize;

          // クリーンアップアニメーション用の計算
          const totalCells = Math.floor(srcImg.width / cellSize) * Math.floor(srcImg.height / cellSize);
          const cellsToHide = Math.floor(totalCells * cleanupProgress);
          let hiddenCells = 0;

          for (let y = 0; y < srcImg.height; y += cellSize) {
            for (let x = 0; x < srcImg.width; x += cellSize) {
              // クリーンアップアニメーション中は段階的にセルを非表示にする
              if (isCleanupAnimating && hiddenCells < cellsToHide) {
                hiddenCells++;
                continue; // このセルをスキップ
              }
              
              const isTextArea = isInTextArea(x, y);
              
              if (isTextArea) {
                const charIndex = Math.floor((x - textX) / cellSize);
                const char = answerText[charIndex];
                if (char && char.trim() !== '') {
                  // クリーンアップアニメーション中は透明度を下げる
                  if (isCleanupAnimating) {
                    const alpha = Math.max(0, 255 * (1 - cleanupProgress));
                    sk.fill(255, 255, 255, alpha);
                  } else {
                    sk.fill(255, 255, 255);
                  }
                  sk.text(char, x, y);
                }
              } else {
                const [r, g, b] = srcImg.get(x, y);
                const lum = (r + g + b) / 3;
                const idx = sk.floor(sk.map(lum, 0, 255, table.length - 1, 0));
                const ch = table[idx] ?? table[0];
                
                // クリーンアップアニメーション中は透明度を下げる
                if (isCleanupAnimating) {
                  const alpha = Math.max(0, lum * (1 - cleanupProgress));
                  sk.fill(alpha);
                } else {
                  sk.fill(lum);
                }
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
          // LoadingTransitionが非アクティブな場合のみリサイズ処理を実行
          if (!isInitialLoading && !isMiniLoading && !isTransitionLoading && p5Instance) {
            try {
              sk.resizeCanvas(sk.windowWidth, sk.windowHeight);
              sk.redraw();
            } catch (error) {
              console.error('p5.js resize error:', error);
            }
          }
        };
      };
      p5Instance = new p5(sketch); // インスタンスの参照を保存
    }).catch(err => {
      statusMessage = "p5.jsの読み込みに失敗しました。";
    });
  });
</script>

<div bind:this={container} aria-label={data.altText}></div>

<!-- 初期ローディングトランジション（大きいバージョン） -->
<LoadingTransition
  cellSize={loadingCellSize}
  isActive={isInitialLoading}
  duration={3000}
  loadingText={data.q}
  on:complete={handleInitialLoadingComplete}
/>

<!-- ミニローディングトランジション -->
<LoadingTransition
  cellSize={loadingCellSize}
  isActive={isMiniLoading}
  duration={5000}
  loadingText={data.q}
  isMini={true}
  miniSize={120}
  on:complete={handleMiniLoadingComplete}
/>

<!-- 遷移前ミニローディングトランジション -->
<LoadingTransition
  cellSize={loadingCellSize}
  isActive={isTransitionLoading}
  duration={TRANSITION_LOADING_DURATION}
  loadingText={data.q}
  isMini={true}
  miniSize={120}
  on:complete={handleTransitionLoadingComplete}
/>

<div class="debug-info">
  <p>Session ID: {data.sessionId || 'なし'}</p>
  <p>Status: {statusMessage}</p>
  <p>Processing: {isProcessing ? 'Yes' : 'No'}</p>
  <p>Has Processed: {hasProcessedTurn ? 'Yes' : 'No'}</p>
  <p>Transition Loading: {isTransitionLoading ? 'Yes' : 'No'}</p>
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