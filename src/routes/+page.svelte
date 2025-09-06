<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import qrcode from 'qrcode-generator';
  import { doc, setDoc, updateDoc, runTransaction, onSnapshot } from 'firebase/firestore';
  import { db } from '$lib/firebase';
  import EditableText from '$lib/component/EditableText.svelte';
  import CellTransition from '$lib/component/CellTransition.svelte'; 

  let p5Instance: any;
  let p5Constructor: any;
  let qrContainer: HTMLDivElement;
  let qrData: { qr: any; modules: number } | null = null;
  let canvasInstance: any; 
  
  // Settings with default values
  let cellSize = 15;
  let fontSize = 15;
  let animationSpeed = 0;
  let backgroundEffect = 'staticGrid';
  let interactivity = 'none';
  let charSet = "ABCあいうえ◯▼잘자WXYZ0123456789";
  let qrText = "mountain";
  let ecLevel = "M";
  let qrMode = 'url'; // 'url' for join page URL, 'text' for original text
  
  // CharSet management
  let baseCharSet = "ABCあいうえ◯▼잘자WXYZ0123456789"; // Original character set
  let isCharSetManuallyEdited = false; // Flag to track manual edits
  
  // Show controls toggle
  let showControls = false;
  
  let editableTextInstance: EditableText; 

  // Grid-based text input
  let sessionId: string | null = null;
  
  // Page transition state
  let isTransitioning = false;

  onMount(() => {
    console.log("1. onMountが開始されました。"); 

    // ユニークなセッションIDを生成
    sessionId = Math.random().toString(36).substring(2, 10);
    const sessionRef = doc(db, 'sessions', sessionId);

    // firestoreに書き出す最初のデータ
    const initialData = {
      conversation:[{ id: 1, sender: 'admin', text: qrText ,updatedAt: new Date()}],
      keyword: qrText,
      updatedAt: new Date(),
    };

    // Firestoreに初期データを書き込む
    setDoc(sessionRef, initialData);

    // Firestoreのリアルタイム監視を設定
    const unsubscribe = onSnapshot(sessionRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        const conversation = data.conversation || [];
        
        // 最新のメッセージをチェック
        if (conversation.length > 1) { // adminメッセージ以外にメッセージがある場合
          const latestMessage = conversation[conversation.length - 1];
          
          if (latestMessage.sender === 'user') {
            console.log('ユーザーからの新しいメッセージを検出:', latestMessage.text);
            
            // keywordを最新のユーザーメッセージのテキストに更新
            updateDoc(sessionRef, {
              keyword: latestMessage.text,
              // updatedAt: new Date()
            }).then(() => {
              console.log('keywordを更新しました:', latestMessage.text);
              
              // トランジションアニメーションを開始
              isTransitioning = true;
              
              // 固定時間後にページ遷移を実行（アニメーション時間 + 少しの余裕）
              setTimeout(() => {
                const encodedKeyword = encodeURIComponent(latestMessage.text);
                console.log('answerページに遷移:', `/answer/${encodedKeyword}?s=${sessionId}`);
                goto(`/answer/${encodedKeyword}?s=${sessionId}`);
              }, 4300); // 4300ms（アニメーション4000ms + 余裕300ms）

            }).catch(error => {
              console.error('keyword更新エラー:', error);
            });
          }
        }
      }
    });

    let cleanup = () => {};
    
    // クライアントサイドのみでp5をロードする
    if (browser) {
      console.log("2. ブラウザ環境です。p5をインポートします。"); 

      // 動的にp5をインポート (型エラーを無視)
      // @ts-ignore
      import('p5').then((p5Module: any) => {
        console.log("3. p5のインポートに成功しました。"); 
        p5Constructor = p5Module.default || p5Module;
        
        // Initialize P5 sketch
        initP5Sketch();
      }).catch((err: any) => {
        console.error("p5のインポートに失敗しました:", err); // ★エラーキャッチを追加
      });
      
      // クリーンアップ関数
      cleanup = () => {
        // Cleanup P5 instance on component unmount
        if (p5Instance) {
          p5Instance.remove();
        }
        // Firestore監視の停止
        unsubscribe();
      };
    } else {
      // ブラウザ環境でない場合もクリーンアップ関数を設定
      cleanup = () => {
        unsubscribe();
      };
    }
    
    return cleanup;
  });

  function toggleSettings() {
    showControls = !showControls;
  }

  // canvasのz-indexを制御するためのリアクティブステート
  $: if (canvasInstance) {
  if (showControls) {
    // Settingsパネルが開いている時：キャンバスを一番後ろに下げる
    canvasInstance.style('z-index', '-1');
  } else {
    // Settingsパネルが閉じている時：キャンバスを元の位置に戻す
    canvasInstance.style('z-index', '1');
  }
}


  function initP5Sketch() {
    console.log("4. initP5Sketchが呼び出されました。"); 
    if (!p5Constructor) return;
    
    // Define the P5.js sketch
    const sketch = (p: any) => {
      console.log("5. p5のsketch関数が実行されました。");
      let backgroundGrid: Array<Array<{
        char: string;
        alpha: number;
        phase: number;
        speed: number;
        baseSize: number;
        active: boolean;
      }>> = [];
      let ripples: Array<{
        x: number;
        y: number;
        size: number;
        speed: number;
        alpha: number;
        decay: number;
      }> = [];
      let time = 0;
      let gridSize = 25;
      let gridCols: number, gridRows: number;
      let isAnimating = false;
      
      // 一旦保留　Settingsボタンの描画はここから
      // Settings button bounds for click detection
      let settingsButtonBounds: { x: number, y: number, width: number, height: number } | null = null;
      // 一旦保留　Settingsボタンの描画はここまで

      // 画面幅に応じてセルのサイズを動的に決定する関数
      const updateResponsiveSizes = () => {
        const breakpoint = 435; // これ以下の幅でスマホ用レイアウトに
        const mobileTargetCellCount = 35; // スマホで横幅に表示するセル数

        if (p.windowWidth <= breakpoint) {
          // スマホの場合：画面幅を基準にセルサイズを計算
          cellSize = p.windowWidth / mobileTargetCellCount;
        } else {
          // PCの場合：固定サイズ
          cellSize = 15;
        }
        // フォントサイズもセルサイズに連動させて見た目を保つ
        fontSize = cellSize;
      };

      // 一旦保留　Settingsボタンの描画はここから
      // Settings button click detection
      function isOnSettingsButton(mouseX: number, mouseY: number): boolean {
        if (!settingsButtonBounds) return false;
        return mouseX >= settingsButtonBounds.x && 
               mouseX <= settingsButtonBounds.x + settingsButtonBounds.width &&
               mouseY >= settingsButtonBounds.y && 
               mouseY <= settingsButtonBounds.y + settingsButtonBounds.height;
      }
      // 一旦保留　Settingsボタンの描画はここまで

      
      p.setup = function() {
        console.log("6. p5.setup()が実行されました。");
        // キャンバスの高さを動的に計算（説明テキストがすべて表示されるように）
        const minHeight = p.windowHeight;
        const estimatedContentHeight = p.windowHeight + 100; // 説明テキスト分の追加高さをさらに削減
        const canvasHeight = Math.max(minHeight, estimatedContentHeight);
        
        const canvas = p.createCanvas(p.windowWidth, canvasHeight);
        canvasInstance = canvas;
        canvas.parent(qrContainer);
        canvas.style('touch-action', 'pan-y');
        p.textAlign(p.CENTER, p.CENTER);
        p.textFont('monospace');

        // 初期ロード時にレスポンシブなサイズを計算
        updateResponsiveSizes();
        
        // Make sure canvas doesn't interfere with UI controls
        canvas.style('z-index', '1');
        
        // Initialize background grid
        initBackgroundGrid();
        
        // Generate initial QR code
        generateQR();
      };
      
      p.windowResized = function() {
        // キャンバスの高さを動的に再計算
        const minHeight = p.windowHeight;
        const estimatedContentHeight = p.windowHeight + 100; // 説明テキスト分の追加高さをさらに削減
        const canvasHeight = Math.max(minHeight, estimatedContentHeight);
        
        p.resizeCanvas(p.windowWidth, canvasHeight);

        // ウィンドウリサイズ時にレスポンシブなサイズを再計算
        updateResponsiveSizes();

        // 背景とQRコードを新しいサイズで再描画
        generateQR();
      };
      
      p.draw = function() {
          // Update time for animations
          time += 0.01;
          
          p.background(255, 255, 255);

          // ★QRコードとテキストエリアの共通パラメータをここで一元管理
          const qrSize = qrData ? qrData.modules * cellSize : 0;
          const offsetX = Math.round(((p.width - qrSize) / 2) / cellSize) * cellSize;
          
          // スマホとPCで異なる位置に配置
          let verticalPosition;
          if (p.width <= 435) {
            // スマホ：さらに上に配置（20%の位置）
            verticalPosition = 0.20;
          } else {
            // PC：従来の位置（25%の位置）
            verticalPosition = 0.25;
          }
          const offsetY = Math.round((p.height * verticalPosition) / cellSize) * cellSize;
          
          // ★テキストエリアの正しい位置を計算
          const textInputRow = Math.floor(offsetY / cellSize) - 2;
          const textInputX = offsetX;
          const textInputY = textInputRow * cellSize;
          // console.log("Text input position:", textInputX, textInputY, "Row:", textInputRow);

          // 1. 背景グリッドを描画（計算したテキスト位置を渡す）
          // EditableTextに渡すのと同じ座標と長さを渡すことで、完全に一致させる
          drawBackgroundGrid({ x: textInputX, y: textInputY, length: qrText.length });

          // 2. QRコードと関連ボタンを描画
          if (qrData) {
              // 説明テキストを描画（QRコードの前に）
              drawExplanationText(offsetX, offsetY, qrSize);
              
              renderQR(); 
              drawGenerateButton();
              drawNavigationButton(offsetX, offsetY + qrSize);
          }
        
          // 3. EditableTextコンポーネントを描画
          if (editableTextInstance) {
              // ★プロパティを直接変更するのではなく、draw関数に引数として渡す
              editableTextInstance.draw(p, textInputX, textInputY, cellSize);
          }
            
          // ripplesなどの描画処理
          drawRipples();
          updateRipples();
      };

        // 指が触れた瞬間のイベントをハンドル
        p.touchStarted = function() {
          // p5.jsによるデフォルトのタッチ開始動作をキャンセルし、
          // ブラウザの動作（スクロール準備など）を妨げないようにtrueを返す。
          return true;
        };

        // 指を動かした時のイベントをハンドル
        p.touchMoved = function() {
          // スクロールなどのブラウザのデフォルト動作を許可するためにtrueを返す。
          return true;
        };
        
      function initBackgroundGrid() {
        backgroundGrid = [];
        // Use the same grid size as QR cell size for perfect alignment
        gridSize = cellSize;
        gridCols = Math.floor(p.width / gridSize);
        gridRows = Math.floor(p.height / gridSize); // 新しいキャンバス高さに基づいて計算
        
        // Get current character set
        const currentCharSet = charSet;
        
        for (let i = 0; i < gridCols; i++) {
          backgroundGrid[i] = [];
          for (let j = 0; j < gridRows; j++) {
            backgroundGrid[i][j] = {
              char: currentCharSet[Math.floor(p.random(currentCharSet.length))],
              alpha: p.random(15, 50),
              phase: p.random(p.TWO_PI),
              speed: p.random(0.01, 0.05),
              baseSize: p.random(fontSize * 0.4, fontSize * 0.8),
              active: p.random() > 0.7
            };
          }
        }
      }
      
      function drawBackgroundGrid(textAreaBounds: { x: number, y: number, length: number }){
        if (backgroundEffect === 'none') return;
        
        p.push();
        
        // 説明テキストエリアをチェックするヘルパー関数
        function isInExplanationArea(gridCol: number, gridRow: number): boolean {
          if (!qrData) return false;
          
          const qrSize = qrData.modules * cellSize;
          const qrOffsetX = Math.round(((p.width - qrSize) / 2) / cellSize) * cellSize;
          const qrOffsetY = Math.round(((p.height - qrSize) / 2) / cellSize) * cellSize;
          
          // textInputRowを基準として計算
          const textInputRow = Math.floor(qrOffsetY / cellSize) - 2;
          
          // Aブロック（QRコードの上）のエリア - textInputRowを基準に
          const blockAStartRow = textInputRow - 18; // Welcome!の開始行
          const blockAEndRow = textInputRow - 7;    // Aブロックの終了行
          const blockAStartCol = Math.floor(qrOffsetX / cellSize);
          const blockAEndCol = blockAStartCol + 24; // 適当な幅
          
          // Bブロック（QRコードの下）のエリア
          const qrBottomRow = Math.floor((qrOffsetY + qrSize) / cellSize);
          const blockBStartRow = qrBottomRow - 2;   // QRコードの2行下
          const blockBEndRow = blockBStartRow + 15; // Bブロックの終了行
          const blockBStartCol = Math.floor(qrOffsetX / cellSize);
          const blockBEndCol = blockBStartCol + 30; // 適当な幅
          
          return (gridRow >= blockAStartRow && gridRow <= blockAEndRow && gridCol >= blockAStartCol && gridCol <= blockAEndCol) ||
                 (gridRow >= blockBStartRow && gridRow <= blockBEndRow && gridCol >= blockBStartCol && gridCol <= blockBEndCol);
        }
        
        // Get navigation button position to skip drawing character there
        let navButtonGridCol = -1, navButtonGridRow = -1;
        let generateButtonCol = -1, generateButtonRow = -1;
        let settingsButtonCol = -1, settingsButtonRow = -1;

        // テキストエリアの行・列を引数から計算
        const textStartRow = Math.floor(textAreaBounds.y / cellSize);
        const textStartCol = Math.floor(textAreaBounds.x / cellSize);
        
        if (qrData) {
          const qrSize = qrData.modules * cellSize;
          const offsetX = Math.round(((p.width - qrSize) / 2) / cellSize) * cellSize;
          const offsetY = Math.round(((p.height - qrSize) / 2) / cellSize) * cellSize;
          
          // Navigation button (below QR code)
          const navRow = Math.floor((offsetY + qrSize) / cellSize) + 2;
          const navCol = Math.floor(offsetX / cellSize) + Math.floor(qrData.modules / 2);
          navButtonGridCol = navCol;
          navButtonGridRow = navRow;
          
          // Text input area (above QR code)
          const textInputRow = Math.floor(offsetY / cellSize) - 2;
          const textInputStartColNum = Math.floor(offsetX / cellSize);
          // textInputStartCol = textInputStartColNum;
          // textInputStartRow = textInputRow;
          
          // Generate button (below text input)
          generateButtonCol = textInputStartColNum + Math.floor(qrData.modules / 2);
          generateButtonRow = textInputRow + 1;
          
          //一旦保留　Settingsボタンの設定はここから
          // Settings button (QRコードの右上に配置)
          const qrRightCol = Math.floor(offsetX / cellSize) + qrData.modules; // QRコードの右端
          settingsButtonCol = qrRightCol + 2; // QRから2セル右
          settingsButtonRow = textInputRow - 2; // テキスト入力と同じ高さ
          // 一旦保留　Settingsボタンの設定はここまで
        }
        
        if (backgroundEffect === 'staticGrid') {
          // Static grid with ASCII characters - aligned with QR cells
          p.stroke(220, 220, 220, 80);
          p.strokeWeight(0.2);
          
          // Draw grid lines aligned with QR cells
          for (let x = 0; x <= p.width; x += cellSize) {
            p.line(x, 0, x, p.height);
          }
          for (let y = 0; y <= p.height; y += cellSize) {
            p.line(0, y, p.width, y);
          }
          
          // Draw grid characters
          for (let i = 0; i < gridCols; i++) {
            for (let j = 0; j < gridRows; j++) {
              // Skip drawing character at special positions
              if (i === navButtonGridCol && j === navButtonGridRow) continue;
              if (i === generateButtonCol && j === generateButtonRow) continue;
              
              // Skip text input area
            let isTextInputArea = false;
            if (j === textStartRow && i >= textStartCol && i < textStartCol + textAreaBounds.length + 1) { // +1は「+」ボタンの分
                isTextInputArea = true;
            }
            
            // Skip explanation text areas using helper function
            if (isTextInputArea || isInExplanationArea(i, j)) continue;
              
              let x = i * cellSize + cellSize / 2;
              let y = j * cellSize + cellSize / 2;
              let cell = backgroundGrid[i][j];
              
              // Mouse interaction with grid
              let mouseDistance = p.dist(p.mouseX, p.mouseY, x, y);
              let influence = p.map(mouseDistance, 0, 100, 1, 0);
              influence = p.constrain(influence, 0, 1);
              
              let alpha = cell.alpha + influence * 60;
              let size = cell.baseSize + influence * 3;
              
              p.fill(160, 160, 160, alpha);
              p.textSize(size);
              p.text(cell.char, x, y);
            }
          }
        } else if (backgroundEffect === 'animatedGrid') {
          // Animated grid with pulsing characters - aligned with QR cells
          p.stroke(220, 220, 220, 60);
          p.strokeWeight(0.15);
          
          // Draw grid lines aligned with QR cells
          for (let x = 0; x <= p.width; x += cellSize) {
            p.line(x, 0, x, p.height);
          }
          for (let y = 0; y <= p.height; y += cellSize) {
            p.line(0, y, p.width, y);
          }
          
          // Draw animated characters
          for (let i = 0; i < gridCols; i++) {
            for (let j = 0; j < gridRows; j++) {
              // Skip drawing character at special positions
              if (i === navButtonGridCol && j === navButtonGridRow) continue;
              if (i === generateButtonCol && j === generateButtonRow) continue;
              
              // Skip text input area
            let isTextInputArea = false;
            if (j === textStartRow && i >= textStartCol && i < textStartCol + textAreaBounds.length + 1) { // +1は「+」ボタンの分
                isTextInputArea = true;
            }
            
            // Skip explanation text areas using helper function
            if (isTextInputArea || isInExplanationArea(i, j)) continue;
              
              let x = i * cellSize + cellSize / 2;
              let y = j * cellSize + cellSize / 2;
              let cell = backgroundGrid[i][j];
              
              if (cell.active) {
                let pulse = p.sin(time * 2 + cell.phase) * 0.5 + 0.5;
                let alpha = cell.alpha + pulse * 40;
                let size = cell.baseSize + pulse * 2;
                
                // Mouse interaction
                let mouseDistance = p.dist(p.mouseX, p.mouseY, x, y);
                let influence = p.map(mouseDistance, 0, 80, 1, 0);
                influence = p.constrain(influence, 0, 1);
                
                alpha += influence * 60;
                size += influence * 4;
                
                p.fill(140, 140, 140, alpha);
                p.textSize(size);
                p.text(cell.char, x, y);
              }
            }
          }
        } else if (backgroundEffect === 'matrixGrid') {
          // Matrix-style falling characters - aligned with QR cells
          p.stroke(0, 255, 0, 20);
          p.strokeWeight(0.15);
          
          // Vertical lines aligned with QR cells
          for (let x = 0; x <= p.width; x += cellSize) {
            p.line(x, 0, x, p.height);
          }
          
          for (let i = 0; i < gridCols; i++) {
            for (let j = 0; j < gridRows; j++) {
              // Skip drawing character at special positions
              if (i === navButtonGridCol && j === navButtonGridRow) continue;
              if (i === generateButtonCol && j === generateButtonRow) continue;
              
              // Skip text input area
            let isTextInputArea = false;
            if (j === textStartRow && i >= textStartCol && i < textStartCol + textAreaBounds.length + 1) { // +1は「+」ボタンの分
                isTextInputArea = true;
            }
            
            // Skip explanation text areas using helper function
            if (isTextInputArea || isInExplanationArea(i, j)) continue;
              
              let x = i * cellSize + cellSize / 2;
              let y = j * cellSize + cellSize / 2;
              let cell = backgroundGrid[i][j];
              
              // Create matrix effect
              let trail = (j / gridRows) * 255;
              let alpha = cell.alpha + p.sin(time * 3 + j * 0.2) * 20;
              
              // Mouse interaction
              let mouseDistance = p.dist(p.mouseX, p.mouseY, x, y);
              let influence = p.map(mouseDistance, 0, 120, 1, 0);
              influence = p.constrain(influence, 0, 1);
              
              alpha += influence * 100;
              
              p.fill(0, 255, 100, alpha);
              p.textSize(cell.baseSize);
              p.text(cell.char, x, y);
            }
          }
        } else if (backgroundEffect === 'neonGrid') {
          // Neon-style glowing grid - aligned with QR cells
          p.stroke(0, 255, 255, 60);
          p.strokeWeight(0.8);
          
          // Draw glowing grid lines aligned with QR cells
          for (let x = 0; x <= p.width; x += cellSize) {
            p.line(x, 0, x, p.height);
          }
          for (let y = 0; y <= p.height; y += cellSize) {
            p.line(0, y, p.width, y);
          }
          
          // Draw neon characters
          for (let i = 0; i < gridCols; i++) {
            for (let j = 0; j < gridRows; j++) {
              // Skip drawing character at special positions
              if (i === navButtonGridCol && j === navButtonGridRow) continue;
              if (i === generateButtonCol && j === generateButtonRow) continue;
              
              // Skip text input area
            let isTextInputArea = false;
            if (j === textStartRow && i >= textStartCol && i < textStartCol + textAreaBounds.length + 1) { // +1は「+」ボタンの分
                isTextInputArea = true;
            }
            
            // Skip explanation text areas using helper function
            if (isTextInputArea || isInExplanationArea(i, j)) continue;
              
              let x = i * cellSize + cellSize / 2;
              let y = j * cellSize + cellSize / 2;
              let cell = backgroundGrid[i][j];
              
              if (cell.active) {
                let glow = p.sin(time * 1.5 + cell.phase) * 0.3 + 0.7;
                
                // Mouse interaction
                let mouseDistance = p.dist(p.mouseX, p.mouseY, x, y);
                let influence = p.map(mouseDistance, 0, 100, 1, 0);
                influence = p.constrain(influence, 0, 1);
                
                glow += influence * 0.6;
                
                // Draw glow effect
                p.fill(255, 0, 255, glow * 120);
                p.textSize(cell.baseSize + 2);
                p.text(cell.char, x, y);
                
                // Draw inner bright character
                p.fill(255, 255, 255, glow * 160);
                p.textSize(cell.baseSize);
                p.text(cell.char, x, y);
              }
            }
          }
        }
        
        p.pop();
      }
      
      // renderQR関数

      function renderQR() {
          if (!qrData) return;
          
          const { qr, modules } = qrData;
          
          // Center the QR code and align with background grid
          let qrSize = modules * cellSize;
          let offsetX = (p.width - qrSize) / 2;
          
          // スマホとPCで異なる位置に配置
          let verticalPosition;
          if (p.width <= 435) {
            // スマホ：さらに上に配置（20%の位置）
            verticalPosition = 0.20;
          } else {
            // PC：従来の位置（25%の位置）
            verticalPosition = 0.25;
          }
          let offsetY = p.height * verticalPosition;
          
          // Snap to grid alignment
          offsetX = Math.round(offsetX / cellSize) * cellSize;
          offsetY = Math.round(offsetY / cellSize) * cellSize;
          
          p.push();
          p.translate(offsetX, offsetY);
          
          for (let r = 0; r < modules; r++) {
            for (let c = 0; c < modules; c++) {
              // ... (QRコードの各セルを描画するロジックは変更なし) ...
              let isDark = qr.isDark(r, c);
              let x = c * cellSize;
              let y = r * cellSize;
              
              let bgColor, fgColor;
              if (isDark) {
                bgColor = p.color(0, 0, 0);
                fgColor = p.color(255, 255, 255, 220);
              } else {
                bgColor = p.color(255, 255, 255);
                fgColor = p.color(150, 150, 150, 60);
              }
              
              p.fill(bgColor);
              p.noStroke();
              p.rect(x, y, cellSize, cellSize);
              
              let charIndex = (r * modules + c) % charSet.length;
              let ch = charSet[charIndex];
              
              p.fill(fgColor);
              p.textSize(fontSize);
              p.text(ch, x + cellSize/2, y + cellSize/2);
            }
          }
          p.pop();
          // ボタン描画の呼び出しはここから削除
      }

      function drawGenerateButton() {
        if (!qrData) return;
        
        const qrSize = qrData.modules * cellSize;
        const offsetX = Math.round(((p.width - qrSize) / 2) / cellSize) * cellSize;
        const offsetY = Math.round(((p.height - qrSize) / 2) / cellSize) * cellSize;
        
        const textInputRow = Math.floor(offsetY / cellSize) - 2;
        const generateButtonCol = Math.floor(offsetX / cellSize) + Math.floor(qrData.modules / 2);
        const generateButtonRow = textInputRow + 1;
        
        if (generateButtonRow < 0) return; // Skip if not enough space
        
        const buttonX = generateButtonCol * cellSize;
        const buttonY = generateButtonRow * cellSize;
        
        // Mouse interaction
        let mouseDistance = p.dist(p.mouseX, p.mouseY, buttonX + cellSize/2, buttonY + cellSize/2);
        let isHovered = mouseDistance < cellSize;
        
        p.push();
        
        // // Draw button background
        // if (isHovered) {
        //   p.fill(255, 200, 100, 80); // Orange on hover
        // } else {
        //   p.fill(255, 220, 150, 40); // Light orange
        // }
        // p.noStroke();
        // p.rect(buttonX, buttonY, cellSize, cellSize);
        
        // // Draw '=' character
        // if (isHovered) {
        //   p.fill(200, 100, 0, 220); // Dark orange on hover
        // } else {
        //   p.fill(180, 120, 60, 160); // Orange
        // }
        
        p.textSize(fontSize);
        // p.text('=', buttonX + cellSize/2, buttonY + cellSize/2);
        
        p.pop();
        
        // Store generate button bounds for click detection
        p.generateButtonBounds = {
          x: buttonX,
          y: buttonY,
          width: cellSize,
          height: cellSize
        };
      }
      
      function drawNavigationButton(startX: number, startY: number) {
        if (!qrData) return;
        
        // Choose a position in the grid below the QR code (center position)
        const navRow = Math.floor(startY / cellSize) + 2; // 2 rows below QR code
        const navCol = Math.floor(startX / cellSize) + Math.floor(qrData.modules / 2); // Center column
        
        const buttonX = navCol * cellSize;
        const buttonY = navRow * cellSize;
        
        // Check if this position is within the background grid
        const gridCol = Math.floor(buttonX / cellSize);
        const gridRow = Math.floor(buttonY / cellSize);
        
        if (gridCol >= 0 && gridCol < gridCols && gridRow >= 0 && gridRow < gridRows) {
          // Mouse interaction
          let mouseDistance = p.dist(p.mouseX, p.mouseY, buttonX + cellSize/2, buttonY + cellSize/2);
          let isHovered = mouseDistance < cellSize;
          
          // Draw navigation button
          p.push();
          
          // Optional subtle background on hover
          if (isHovered) {
            p.fill(200, 200, 200, 30);
            p.noStroke();
            p.rect(buttonX, buttonY, cellSize, cellSize);
          }
          
          // Draw ">" character
          if (isHovered) {
            p.fill(100, 100, 100, 200); // Darker on hover
          } else {
            p.fill(160, 160, 160, 120); // Normal gray
          }
          
          p.textSize(fontSize);
          p.text('＞', buttonX + cellSize/2, buttonY + cellSize/2);
          
          p.pop();
          
          // Store navigation button bounds for click detection
          p.navAreaBounds = {
            x: buttonX,
            y: buttonY,
            width: cellSize,
            height: cellSize
          };
        }
      }
      
      function drawExplanationText(qrOffsetX: number, qrOffsetY: number, qrSize: number) {
        if (!qrData) return;
        
        // textInputRowを基準として計算
        const textInputRow = Math.floor(qrOffsetY / cellSize) - 2;
        
        // 一文字ずつ描画するヘルパー関数
        function drawCharAtPosition(char: string, type: 'a' | 'b' | 'c', rowOffset: number, colOffset: number, color: {r: number, g: number, b: number, a: number} = {r: 80, g: 80, b: 80, a: 200}, bold: boolean = false) {
          const targetRow = textInputRow + rowOffset;
          
          // タイプに応じたセルサイズを計算
          let cellSpan: number;
          let fontSize: number;
          switch (type) {
            case 'a': // 3×3セル相当
              cellSpan = 3;
              fontSize = cellSize * 2.5;
              break;
            case 'b': // 2×2セル相当
              cellSpan = 2;
              fontSize = cellSize * 1.5;
              break;
            case 'c': // 1×1セル相当
              cellSpan = 1;
              fontSize = cellSize * 0.9;
              break;
          }
          
          const charX = qrOffsetX + (colOffset * cellSize) + (cellSpan * cellSize / 2);
          const charY = targetRow * cellSize;
          
          p.push();
          p.textAlign(p.CENTER, p.CENTER);
          p.textFont('monospace');
          p.fill(color.r, color.g, color.b, color.a);
          p.textSize(fontSize);
          if (bold) {
            p.textStyle(p.BOLD);
          } else {
            p.textStyle(p.NORMAL);
          }
          
          p.text(char, charX, charY);
          p.pop();
          
          return cellSpan; // 使用したセル数を返す
        }
        
        // 文字列を一文字ずつ描画する関数
        function drawStringAtRow(text: string, type: 'a' | 'b' | 'c', rowOffset: number, startCol: number, color: {r: number, g: number, b: number, a: number}, bold: boolean = false): number {
          let currentCol = startCol;
          const maxCols = 32; // QRの端から32セル分
          
          for (let i = 0; i < text.length; i++) {
            const char = text[i];
            
            // 32セルを超える場合は折り返し（今回は目視で配置するため、警告のみ）
            if (currentCol >= maxCols) {
              console.warn(`Text overflow at position ${i} in "${text}"`);
              break;
            }
            
            const cellSpan = drawCharAtPosition(char, type, rowOffset, currentCol, color, bold);
            
            // タイプに応じたセル幅で次の位置を計算
            switch (type) {
              case 'a': currentCol += 3; break;
              case 'b': currentCol += 2; break;
              case 'c': currentCol += 1; break;
            }
          }
          
          return currentCol; // 最終位置を返す
        }
        
        // Aブロック（QRコードの上）の描画
        // Welcome! (aタイプ、-11行目)
        drawStringAtRow('Welcome!', 'a', -11, 0, {r: 80, g: 80, b: 80, a: 220}, true);

        // This is (cタイプ、-8行目)
        let currentCol = drawStringAtRow('This is ', 'c', -7, 0, {r: 120, g: 120, b: 120, a: 160}, false);
        
        // ASCII-QR (bタイプ、同じ行で続く)
        currentCol = drawStringAtRow('ASCII-QR', 'b', -7, currentCol, {r: 60, g: 60, b: 60, a: 200}, true);

        // , (cタイプ、同じ行で続く)
        drawStringAtRow(',', 'c', -7, currentCol, {r: 120, g: 120, b: 120, a: 160}, false);

        // where you can interact (cタイプ、-6行目)
        currentCol = drawStringAtRow('where you can interact', 'c', -5, 0, {r: 120, g: 120, b: 120, a: 160}, false);

        // through ASCII art (cタイプ，次の行)
        currentCol = drawStringAtRow('with AI through ASCII art', 'c', -4, 0, {r: 120, g: 120, b: 120, a: 160}, false);
        
        // Shiritori (bタイプ、次の行)
        currentCol = drawStringAtRow('Shiritori', 'b', -2, 0, {r: 60, g: 60, b: 60, a: 200}, true);

        // . (cタイプ、同じ行で続く)
        drawStringAtRow('. v2.1', 'c', -2, currentCol, {r: 120, g: 120, b: 120, a: 160}, false);

        // Bブロック（QRコードの下）の描画
        // QRコードの下の開始位置を計算
        const qrBottomRow = Math.floor((qrOffsetY + qrSize) / cellSize);
        const blockBStartOffset = qrBottomRow - textInputRow + 4; // QRコードの4行下

        // Scan (bタイプ)
        currentCol = drawStringAtRow('Scan', 'b', blockBStartOffset, 0, {r: 60, g: 60, b: 60, a: 200}, true);
        
        // the QR code with your, (cタイプ、同じ行で続く)
        currentCol = drawStringAtRow(' the QRcode with your, ', 'c', blockBStartOffset, currentCol, {r: 120, g: 120, b: 120, a: 160}, false);
        
        // smartphone (cタイプ、次の行)
        currentCol = drawStringAtRow('smartphone', 'c', blockBStartOffset + 2, 0, {r: 120, g: 120, b: 120, a: 160}, true);

        // look for (bタイプ、同じ行で続く)
        currentCol = drawStringAtRow('look for', 'b', blockBStartOffset + 2, currentCol, {r: 60, g: 60, b: 60, a: 200}, false);

        // the(cタイプ、同じ行で続く)
        drawStringAtRow('the', 'c', blockBStartOffset + 2, currentCol, {r: 120, g: 120, b: 120, a: 160}, false);

        //  word (cタイプ，次の行)
        currentCol = drawStringAtRow('word', 'c', blockBStartOffset + 4, 0, {r: 120, g: 120, b: 120, a: 160}, true);

        // "{qrText}" (bタイプ、同じ行で続く)
        currentCol = drawStringAtRow(`"${qrText}"`, 'b', blockBStartOffset + 4, currentCol, {r: 60, g: 60, b: 60, a: 200}, true);

        // , and (cタイプ、同じ行で続く)
        currentCol = drawStringAtRow(', and ', 'c', blockBStartOffset + 4, currentCol, {r: 120, g: 120, b: 120, a: 160}, false);

        
        // tap it (bタイプ、次の行)
        currentCol = drawStringAtRow('tap it!', 'b', blockBStartOffset + 6, 0, {r: 60, g: 60, b: 60, a: 200}, true);
        
        // . (cタイプ、同じ行で続く)
        drawStringAtRow('.', 'c', blockBStartOffset + 6, currentCol, {r: 120, g: 120, b: 120, a: 160}, false);

        // If you send the next word... (cタイプ、次の行)
        drawStringAtRow('If you send the next word, ', 'c', blockBStartOffset + 8, 0, {r: 120, g: 120, b: 120, a: 160}, false);

        //something on this site may change based on your input... (cタイプ、次の行)
        drawStringAtRow('something on this site may', 'c', blockBStartOffset + 9, 0, {r: 120, g: 120, b: 120, a: 160}, false);

        //may change based on your input...(cタイプ、次の行)
        drawStringAtRow('change based on your input...', 'c', blockBStartOffset + 10, 0, {r: 120, g: 120, b: 120, a: 160}, false);
        
        // How many words (bタイプ、次の行)
        drawStringAtRow('How many words', 'b', blockBStartOffset + 12, 0, {r: 60, g: 60, b: 60, a: 200}, true);

        //can you connect? (bタイプ、次の行)
        drawStringAtRow('can you connect?', 'b', blockBStartOffset + 14, 0, {r: 60, g: 60, b: 60, a: 200}, true);
        
        // 一旦保留　Settingsボタンの描画はここから
        // Settings表示（QRコードの右上）
        const qrRightCol = Math.floor(qrOffsetX / cellSize) + Math.floor(qrSize / cellSize); // QRコードの右端
        const settingsStartCol = qrRightCol + 2; // QRから2セル右
        if (p.width <= 435) {
          // スマホ：「set」のみ表示（cタイプ）
          drawStringAtRow('set', 'c', -2, settingsStartCol, {r: 100, g: 100, b: 100, a: 200}, true);
        } else {
          // PC：「Settings」表示（bタイプ）
          drawStringAtRow('Settings', 'b', -2, settingsStartCol, {r: 100, g: 100, b: 100, a: 200}, true);
        }
        
        // Settingsボタンの境界を保存（クリック検出用）
        const settingsText = p.width <= 435 ? 'set' : 'Settings';
        const settingsWidth = settingsText.length * (p.width <= 435 ? 1 : 2); // タイプに応じたセル幅
        settingsButtonBounds = {
          x: settingsStartCol * cellSize,
          y: (textInputRow - 2) * cellSize, // テキスト入力と同じ高さ
          width: settingsWidth * cellSize,
          height: cellSize
        };
        //一旦保留　Settingsボタンの描画はここまで
      }


      
      function drawRipples() {
        for (let ripple of ripples) {
          p.push();
          p.noFill();
          p.stroke(100, 200, 255, ripple.alpha);
          p.strokeWeight(2);
          p.ellipse(ripple.x, ripple.y, ripple.size, ripple.size);
          p.pop();
        }
      }
      
      function updateRipples() {
        for (let i = ripples.length - 1; i >= 0; i--) {
          let ripple = ripples[i];
          ripple.size += ripple.speed;
          ripple.alpha -= ripple.decay;
          
          if (ripple.alpha <= 0) {
            ripples.splice(i, 1);
          }
        }
      }
      
      p.mousePressed = function() {
          // --- 判定の順序が最重要 ---

          // 1. 次に「Settingsパネル（開いている場合）」がクリックされたかを判定
          if (showControls) {
              // この時点でボタンのクリックは既に処理済み。
              // ここに到達した場合、クリックはパネルの他の部分なので、ブラウザに任せる。
              return true;
          }

          // --- ここからはパネルが閉じている時のキャンバス操作 ---

          // 3. EditableTextコンポーネントのクリック処理
          if (editableTextInstance && editableTextInstance.mousePressed(p)) {
              return false;
          }

          // 4. その他のキャンバス上のボタン類（Settings, Generate, Navigation）のクリック処理
          // 一旦保留　Settingsボタンのクリック処理　はここから
          // Settings button (character-based)
          if (isOnSettingsButton(p.mouseX, p.mouseY)) {
              showControls = !showControls;
              return false;
          }
          // 一旦保留　Settingsボタンのクリック処理　はここまで
          
          if (p.generateButtonBounds) {
              const bounds = p.generateButtonBounds;
              if (p.mouseX >= bounds.x && p.mouseX <= bounds.x + bounds.width && p.mouseY >= bounds.y && p.mouseY <= bounds.y + bounds.height) {
                  if (typeof window !== 'undefined' && (window as any).handleGenerateClick) {
                      (window as any).handleGenerateClick();
                  }
                  return false;
              }
          }
          
          if (p.navAreaBounds && qrData) {
              const bounds = p.navAreaBounds;
              if (p.mouseX >= bounds.x && p.mouseX <= bounds.x + bounds.width && p.mouseY >= bounds.y && p.mouseY <= bounds.y + bounds.height) {
                  if (typeof window !== 'undefined' && (window as any).navigateToAscii) {
                      (window as any).navigateToAscii();
                  }
                  return false;
              }
          }
          
          // 5. キャンバスの地の部分のクリック
          if (interactivity === 'ripple') {
            ripples.push({ x: p.mouseX, y: p.mouseY, size: 0, speed: 8, alpha: 255, decay: 5 });
          }
          return true;
      };
      // Make the generateQR function accessible from outside
      p.generateQR = function() {
        generateQR();
      };
      
      // Method to update the settings
      p.updateSettings = function() {
        // Settings are automatically updated via reactive variables
        isAnimating = animationSpeed > 0;
        initBackgroundGrid();
      };
      
      function generateQR() {
        if (!sessionId) return; // セッションIDがなければ何もしない

        // QRコードのエラー修正レベルを適切に設定
        const qr = qrcode(0, ecLevel as any);
        
        // qrModeに基づいてQRコードのデータを決定
        let qrCodeData: string;
        if (qrMode === 'text') {
          // オリジナルテキストモード: qrTextをそのまま使用
          qrCodeData = qrText;
        } else {
          // URLモード: joinページへのURLを生成
          qrCodeData = `${location.origin}/join?s=${sessionId}`;
        }
        
        qr.addData(qrCodeData);
        qr.make();
        
        const modules = qr.getModuleCount();
        qrData = { qr, modules };
        
        // No need to resize canvas - it fills the screen
        initBackgroundGrid();
      }
    };

    // Create P5 instance and store reference
    p5Instance = new p5Constructor(sketch);
  }

  function updateSettings() {
    // Update P5 instance when settings change
    if (p5Instance && p5Instance.updateSettings) {
      p5Instance.updateSettings();
    }
  }

  function generateQR() {
    // Generate QR code using P5 instance
    if (p5Instance && p5Instance.generateQR) {
      p5Instance.generateQR();
    }
  }

  function downloadImage() {
    // Download QR code image
    if (p5Instance) {
      p5Instance.save('grid_ascii_qr.png');
    }
  }

  // Watch for changes in settings and qrText
  $: if (p5Instance) {
    updateSettings();
  }
  
  // Watch for qrText changes and regenerate QR
  $: if (p5Instance && qrText !== undefined) {
    generateQR();
  }
  
  // Watch for qrMode changes and regenerate QR
  $: if (p5Instance && qrMode) {
    generateQR();
  }
  
  // Navigation function that can be called from p5.js
  function navigateToAscii() {
    // Check if the keyword is "hint" and navigate to hint page
    if (qrText.toLowerCase().trim() === 'hint') {
      // Use window.location for hint page to ensure server-side load
      if (typeof window !== 'undefined') {
        window.location.href = '/hint';
      }
    } else {
      // トランジションアニメーションを開始
      isTransitioning = true;
      
      // 固定時間後にページ遷移を実行（アニメーション時間 + 少しの余裕）
      setTimeout(() => {
        const encodedKeyword = encodeURIComponent(qrText);
        goto(`/ascii/${encodedKeyword}?s=${sessionId}`);
      }, 4500); // 4500ms（アニメーション4000ms + 余裕500ms）
    }
  }
  
  // トランジション完了時にページ遷移を実行
  function handleTransitionComplete() {
    // Firestoreから最新のconversationを取得して遷移先を決定
    if (!sessionId) return;
    
    const sessionRef = doc(db, 'sessions', sessionId);
    
    // 最新のデータを一度だけ取得
    import('firebase/firestore').then(({ getDoc }) => {
      getDoc(sessionRef).then((doc) => {
        if (doc.exists()) {
          const data = doc.data();
          const conversation = data.conversation || [];
          
          if (conversation.length > 1) {
            const latestMessage = conversation[conversation.length - 1];
            if (latestMessage.sender === 'user') {
              // answer/[keyword]ページに移動
              const encodedKeyword = encodeURIComponent(latestMessage.text);
              goto(`/answer/${encodedKeyword}?s=${sessionId}`);
            }
          }
        }
      });
    });
  }
  
  // Make navigation function available globally for p5.js
  $: if (browser && typeof window !== 'undefined') {
    (window as any).navigateToAscii = navigateToAscii;
  }
  
  // Sync qrText characters to charSet automatically
  $: {
    // qrTextが空文字""の場合も実行されるように、条件を`undefined`でないことに変更
    if (qrText !== undefined && !isCharSetManuallyEdited) {
      syncQrTextToCharSet();
    }
  }

// Function to sync qrText characters to charSet
function syncQrTextToCharSet() {
  // qrTextが有効な文字列であるかを確認
  if (qrText && qrText.length > 0) {
    // qrTextからユニークな文字を取得し、それだけでcharSetを構成する
    const qrTextChars = [...new Set(qrText.split(''))];
    charSet = qrTextChars.join('');
  } else {
    // qrTextが空の場合は、描画文字を「-」に設定する
    charSet = '-';
  }
}
  
  // Handle manual charSet editing
  function handleCharSetChange() {
    isCharSetManuallyEdited = true;
    // Remove duplicates from manually edited charSet
    const uniqueChars = [...new Set(charSet.split(''))];
    charSet = uniqueChars.join('');
  }
  
  // Reset charSet to auto-sync mode
  function resetCharSetSync() {
    isCharSetManuallyEdited = false;
    syncQrTextToCharSet();
  }
  
// Add keyboard event listener
$: if (browser && typeof window !== 'undefined') {
  (window as any).navigateToAscii = navigateToAscii;
  (window as any).handleGenerateClick = generateQR;
  (window as any).toggleSettings = toggleSettings;
}

  // Svelteスクリプトのトップレベルに追加
  let debounceTimer: any;

  // qrTextが変更されたら、Firestoreのデータを更新する
  $: if (browser && sessionId && qrText) {
    // ★デバウンス処理：入力が500ms止まったら更新を実行
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      // セッションIDが確実に存在する場合のみ処理を継続
      if (!sessionId) return;
      
      const sessionRef = doc(db, 'sessions', sessionId);

      // ★トランザクションを使って安全に更新
      runTransaction(db, async (transaction) => {
        const sessionDoc = await transaction.get(sessionRef);
        if (!sessionDoc.exists()) return;

        const conversation = sessionDoc.data().conversation || [];
        
        // 最初のメッセージが管理者(admin)のものなら、そのtextを更新
        if (conversation.length > 0 && conversation[0].sender === 'admin') {
          conversation[0].text = qrText;
        }
        
        transaction.update(sessionRef, { 
          conversation: conversation,
          keyword: qrText,
          updatedAt: new Date() // サーバーの正確な時刻を使用
        });
      });

    }, 500); // 500ミリ秒待つ
  }
</script>

<div id="qrContainer" bind:this={qrContainer}>
  {#if sessionId && qrText}
    <a 
      href="/ascii/{encodeURIComponent(qrText)}?s={sessionId}" 
      target="_blank"
      rel="noopener noreferrer"
      style="position: absolute; top: 10px; left: 10px; z-index: 1000; color: blue; text-decoration: underline;"
    >
      test link to /{encodeURIComponent(qrText)}?s={sessionId}
    </a>
  {/if}
</div>

<EditableText
  bind:this={editableTextInstance}
  bind:value={qrText}
  cellSize={cellSize}
  fontSize={fontSize}
/>

<!-- Settings button is now drawn using the character positioning system -->

<div class="controls-panel" class:show={showControls}>
  <div>
    <label for="qrText">Text to encode</label>
    <textarea 
      id="qrText" 
      rows="2" 
      placeholder="Enter text..." 
      bind:value={qrText}
      on:input={() => {
        // Force QR regeneration on direct textarea input
        setTimeout(() => {
          if (p5Instance) generateQR();
        }, 0);
      }}
    ></textarea>
    <label for="sessionId">Session ID: {sessionId}</label>

    <label for="cellSize">Cell size: {cellSize}px</label>
    <input type="range" id="cellSize" min="8" max="48" bind:value={cellSize}>

    <label for="fontSize">Font size: {fontSize}px</label>
    <input type="range" id="fontSize" min="6" max="32" bind:value={fontSize}>

    <label for="ecLevel">Error correction</label>
    <select id="ecLevel" bind:value={ecLevel}>
      <option value="L">L (7%)</option>
      <option value="M">M (15%)</option>
      <option value="Q">Q (25%)</option>
      <option value="H">H (30%)</option>
    </select>

    <label for="qrMode">QR Code Mode</label>
    <select id="qrMode" bind:value={qrMode}>
      <option value="url">Join Page URL</option>
      <option value="text">Original Text</option>
    </select>

    <label for="backgroundEffect">Background</label>
    <select id="backgroundEffect" bind:value={backgroundEffect}>
      <option value="none">None</option>
      <option value="staticGrid">Static Grid</option>
      <option value="animatedGrid">Animated Grid</option>
      <option value="matrixGrid">Matrix Grid</option>
      <option value="neonGrid">Neon Grid</option>
    </select>

    <label for="interactivity">Interaction</label>
    <select id="interactivity" bind:value={interactivity}>
      <option value="none">None</option>
      <option value="hover">Hover</option>
      <option value="ripple">Ripple</option>
      <option value="glow">Glow</option>
    </select>

    <label for="charSet">Characters 
      {#if isCharSetManuallyEdited}
        <span style="color: #ff6b6b; font-size: 10px;">(Manual)</span>
        <button 
          type="button" 
          on:click={resetCharSetSync}
          style="margin-left: 5px; padding: 1px 4px; font-size: 9px; background: #666; border: none; color: white; border-radius: 2px; cursor: pointer;"
          title="Reset to auto-sync with QR text"
        >↻</button>
      {:else}
        <span style="color: #4caf50; font-size: 10px;">(Auto-sync)</span>
      {/if}
    </label>
    <input 
      type="text" 
      id="charSet" 
      bind:value={charSet}
      on:input={handleCharSetChange}
    >

    <label for="animationSpeed">Speed: {animationSpeed}</label>
    <input type="range" id="animationSpeed" min="0" max="100" bind:value={animationSpeed}>

    <button on:click={generateQR}>Generate</button>
    <button on:click={downloadImage}>Download</button>
  </div>
</div>

<!-- Page transition effect -->
<CellTransition
  cellSize={cellSize}
  isActive={isTransitioning}
  duration={4000}
  on:complete={handleTransitionComplete}
/>



<style>
  :global(body) {
    margin: 0;
    padding: 0;
    background: #fff;
    overflow: auto; /* スクロールを許可 */
    height: auto; /* 高さを自動調整 */
    min-height: 100%; /* 最小高さを画面高さに設定 */
    -webkit-overflow-scrolling: touch; /* iOS Safariでスムーズスクロール */
  }

  #qrContainer {
    position: absolute; /* fixedからabsoluteに変更してスクロールに対応 */
    top: 0;
    left: 0;
    width: 100%;
    min-height: 100%; /* 最小高さを画面の高さに設定 */
  }

  .controls-panel {
    position: fixed;
    top: 10px;
    right: 10px;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 10px;
    border-radius: 8px;
    font-size: 12px;
    z-index: 2000;
    max-width: 250px;
    display: none;
    pointer-events: auto;
  }

  .controls-panel.show {
    display: block;
    pointer-events: auto;
  }

  .controls-panel label {
    display: block;
    margin-bottom: 5px;
    font-weight: 600;
    pointer-events: auto;
  }

  .controls-panel input,
  .controls-panel select,
  .controls-panel textarea {
    width: 100%;
    padding: 3px;
    margin-bottom: 8px;
    border: 1px solid #666;
    border-radius: 4px;
    font-size: 11px;
    pointer-events: auto;
  }

  .controls-panel button {
    padding: 5px 8px;
    border: none;
    border-radius: 4px;
    background: #0070f3;
    color: #fff;
    font-size: 11px;
    cursor: pointer;
    margin-right: 5px;
    pointer-events: auto;
  }

  .controls-panel button:hover {
    background: #0059c9;
  }
</style>
