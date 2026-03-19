<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import qrcode from 'qrcode-generator';
  import { doc, onSnapshot } from 'firebase/firestore';
  import { db } from '$lib/firebase';
  import EditableText from '$lib/component/EditableText.svelte'; 
  import CellTransition from '$lib/component/CellTransition.svelte'; 

  export let data: {
    sessionId: string | null;
  };

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
  let qrText = "";
  let ecLevel = "M";
  let qrMode = 'url'; // 'url' for join page URL, 'text' for original text
  let customQrData = "https://example.com"; // Default for custom mode
  
  // CharSet management
  let baseCharSet = "ABCあいうえ◯▼잘자WXYZ0123456789"; // Original character set
  let isCharSetManuallyEdited = false; // Flag to track manual edits
  
  // Show controls toggle
  let showControls = false;
  
  let editableTextInstance: EditableText; 

  // セッションIDを使用（answerページから渡されたもの）
  let sessionId = data.sessionId;
  
  // 監視用の状態変数
  let lastConversationLength = 0;
  let isNavigating = false; // 遷移中フラグを追加
  
  // Page transition state
  let isTransitioning = false;
  
  // Variables for displaying previous and current words
  let previousWord = "";
  let currentWord = "";
  let displayText = "";

  onMount(() => {
    console.log("Create page mounted with sessionId:", sessionId);

    if (!sessionId) {
      console.error('セッションIDが提供されていません');
      // デバッグ用にリダイレクトを無効化
      sessionId = 'demo';
    }

    // Firestoreのリアルタイム監視を設定（最新の会話テキストの文字数分の?をqrTextに設定）
    const sessionRef = doc(db, 'sessions', sessionId);
    const unsubscribe = onSnapshot(sessionRef, (doc) => {
      if (doc.exists()) {
        const docData = doc.data();
        const conversation = docData.conversation || [];
        
        // 初期化時に現在の会話長を記録
        if (lastConversationLength === 0) {
          lastConversationLength = conversation.length;
          console.log('初期会話長を設定:', lastConversationLength);
        }
        
        // 新しいメッセージが追加されたかチェック
        if (conversation.length > lastConversationLength && !isNavigating) {
          const latestMessage = conversation[conversation.length - 1];
          console.log('新しいメッセージを検出:', latestMessage);
          
          // ユーザーからの新しいメッセージの場合のみ遷移
          if (latestMessage.sender === 'user') {
            console.log('ユーザーからの新しいメッセージを検出:', latestMessage.text);
            
            // 遷移中フラグを立てる
            isNavigating = true;
            
            // トランジションアニメーションを開始
            isTransitioning = true;
            
            // 固定時間後にページ遷移を実行（アニメーション時間 + 少しの余裕）
            setTimeout(() => {
              const encodedKeyword = encodeURIComponent(latestMessage.text);
              console.log('answerページに遷移:', `/answer/${encodedKeyword}?s=${sessionId}`);
              goto(`/answer/${encodedKeyword}?s=${sessionId}`);
            }, 4500); // 4500ms（アニメーション4000ms + 余裕500ms）
            
            return;
          }
        }
        
        // 会話長を更新
        lastConversationLength = conversation.length;
        
        // 最新のメッセージの文字数を取得して?をqrTextに設定（初期表示用）
        if (conversation.length > 0) {
          const latestMessage = conversation[conversation.length - 1];
          const textLength = latestMessage.text ? latestMessage.text.length : 0;
          qrText = "?".repeat(textLength) || "?";
          console.log('最新テキスト文字数:', textLength, 'qrText更新:', qrText);
          
          // 前の単語と現在の単語を取得してdisplayTextを更新
          if (conversation.length >= 2) {
            // 前の単語（一つ前のメッセージ）
            const previousMessage = conversation[conversation.length - 2];
            previousWord = previousMessage.text || "";
            
            // 現在の単語（最新のメッセージ）
            currentWord = latestMessage.text || "";
            
            // 表示テキストを作成: {前の単語}>{今の単語(?)}
            const currentWordDisplay = "?".repeat(currentWord.length) || "?";
            displayText = `${previousWord} > ${currentWordDisplay}`;
          } else if (conversation.length === 1) {
            // 最初のメッセージの場合
            currentWord = latestMessage.text || "";
            const currentWordDisplay = "?".repeat(currentWord.length) || "?";
            displayText = currentWordDisplay;
          }
          
          console.log('displayText更新:', displayText);
        }
      }
    });

    let cleanup = () => {};
    
    // クライアントサイドのみでp5をロードする
    if (browser) {
      console.log("ブラウザ環境です。p5をインポートします。"); 

      // 動的にp5をインポート (型エラーを無視)
      // @ts-ignore
      import('p5').then((p5Module: any) => {
        console.log("p5のインポートに成功しました。"); 
        p5Constructor = p5Module.default || p5Module;
        
        // Initialize P5 sketch
        initP5Sketch();
      }).catch((err: any) => {
        console.error("p5のインポートに失敗しました:", err);
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

  function toggleQrMode() {
    qrMode = qrMode === 'url' ? 'text' : 'url';
    console.log("QR Mode toggled:", qrMode);
  }

  // canvasのz-indexを制御するためのリアクティブステート
  $: if (canvasInstance) {
    // 常にキャンバスを最背面に保つ
    canvasInstance.style('z-index', '-1');
  }


  function initP5Sketch() {
    console.log("initP5Sketchが呼び出されました。"); 
    if (!p5Constructor) return;
    
    // Define the P5.js sketch
    const sketch = (p: any) => {
      console.log("p5のsketch関数が実行されました。");
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

      
      p.setup = function() {
        console.log("p5.setup()が実行されました。");
        const canvas = p.createCanvas(p.windowWidth, p.windowHeight);
        canvasInstance = canvas;
        canvas.parent(qrContainer);
        p.textAlign(p.CENTER, p.CENTER);
        p.textFont('monospace');

        // 初期ロード時にレスポンシブなサイズを計算
        updateResponsiveSizes();
        
        // Make sure canvas doesn't interfere with UI controls
        // キャンバスを背面に配置して、UI要素（フッターなど）をさわれるようにする
        canvas.style('z-index', '-1');
        
        // Initialize background grid
        initBackgroundGrid();
        
        // Generate initial QR code
        generateQR();
      };
      
      p.windowResized = function() {
        p.resizeCanvas(p.windowWidth, p.windowHeight);

        // ウィンドウリサイズ時にレスポンシブなサイズを再計算
        updateResponsiveSizes();

        // 背景とQRコードを新しいサイズで再描画
        generateQR();
      };
      
      p.draw = function() {
          p.background(255, 255, 255);

          // ★QRコードとテキストエリアの共通パラメータをここで一元管理
          const qrSize = qrData ? qrData.modules * cellSize : 0;
          const offsetX = Math.round(((p.width - qrSize) / 2) / cellSize) * cellSize;
          const offsetY = Math.round(((p.height - qrSize) / 2) / cellSize) * cellSize;
          
          // ★テキストエリアの正しい位置を計算
          const textInputRow = Math.floor(offsetY / cellSize) - 2;
          const textInputX = offsetX;
          const textInputY = textInputRow * cellSize;

          // 1. 背景グリッドを描画（計算したテキスト位置を渡す）
          drawBackgroundGrid({ x: textInputX, y: textInputY, length: qrText.length });

          // 2. QRコードと関連ボタンを描画
          if (qrData) {
              renderQR(); 
              drawGenerateButton();
              drawNavigationButton(offsetX, offsetY + qrSize);
              
              // QRコードの上にdisplayTextを表示
              drawDisplayText(offsetX, offsetY);
          }
        
          // 3. EditableTextコンポーネントを描画
          if (editableTextInstance) {
              // ★プロパティを直接変更するのではなく、draw関数に引数として渡す
              editableTextInstance.draw(p, textInputX, textInputY, cellSize);
          }
            
          // ripplesなどの描画処理
          drawRipples();
          updateRipples();

          // マウスカーソル制御
          let isHovering = false;
          
          // 既存のボタン判定
          if (p.generateButtonBounds) {
             const b = p.generateButtonBounds;
             if (p.mouseX >= b.x && p.mouseX <= b.x + b.width && p.mouseY >= b.y && p.mouseY <= b.y + b.height) {
                 isHovering = true;
             }
          }
          if (p.navAreaBounds && qrData) {
              const b = p.navAreaBounds;
               if (p.mouseX >= b.x && p.mouseX <= b.x + b.width && p.mouseY >= b.y && p.mouseY <= b.y + b.height) {
                 isHovering = true;
             }
          }
          // EditableText判定
          if (editableTextInstance && editableTextInstance.isMouseOver(p)) {
              isHovering = true;
          }
          
          if (isHovering) {
              p.cursor(p.HAND);
          } else {
              p.cursor(p.ARROW);
          }
      };
        
      function initBackgroundGrid() {
        backgroundGrid = [];
        // Use the same grid size as QR cell size for perfect alignment
        gridSize = cellSize;
        gridCols = Math.floor(p.width / gridSize);
        gridRows = Math.floor(p.height / gridSize);
        
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
        
        // Get navigation button position to skip drawing character there
        let navButtonGridCol = -1, navButtonGridRow = -1;
        let generateButtonCol = -1, generateButtonRow = -1;

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
          
          // Generate button (below text input)
          generateButtonCol = textInputStartColNum + Math.floor(qrData.modules / 2);
          generateButtonRow = textInputRow + 1;
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
            if (isTextInputArea) continue;
            
            // Skip displayText area (above QR code)
            let isDisplayTextArea = false;
            if (qrData && displayText) {
              const qrSize = qrData.modules * cellSize;
              const qrOffsetX = Math.round(((p.width - qrSize) / 2) / cellSize) * cellSize;
              const qrOffsetY = Math.round(((p.height - qrSize) / 2) / cellSize) * cellSize;
              const displayTextRow = Math.floor((qrOffsetY - cellSize * 4) / cellSize);
              const displayTextCols = Math.ceil(displayText.length * fontSize * 2 / cellSize); // フォントサイズ2倍に対応
              const displayTextStartCol = Math.floor(qrOffsetX / cellSize) + Math.floor(qrData.modules / 2) - Math.floor(displayTextCols / 2);
              if (j >= displayTextRow - 1 && j <= displayTextRow + 1 && 
                  i >= displayTextStartCol - 2 && i <= displayTextStartCol + displayTextCols + 2) {
                isDisplayTextArea = true;
              }
            }
            if (isDisplayTextArea) continue;
              
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
          // Same as original - animated grid logic here
          p.stroke(220, 220, 220, 60);
          p.strokeWeight(0.15);
          
          for (let x = 0; x <= p.width; x += cellSize) {
            p.line(x, 0, x, p.height);
          }
          for (let y = 0; y <= p.height; y += cellSize) {
            p.line(0, y, p.width, y);
          }
          
          for (let i = 0; i < gridCols; i++) {
            for (let j = 0; j < gridRows; j++) {
              if (i === navButtonGridCol && j === navButtonGridRow) continue;
              if (i === generateButtonCol && j === generateButtonRow) continue;
              
              let isTextInputArea = false;
              if (j === textStartRow && i >= textStartCol && i < textStartCol + textAreaBounds.length + 1) {
                  isTextInputArea = true;
              }
              if (isTextInputArea) continue;
              
              // Skip displayText area (above QR code)
              let isDisplayTextArea = false;
              if (qrData && displayText) {
                const qrSize = qrData.modules * cellSize;
                const qrOffsetX = Math.round(((p.width - qrSize) / 2) / cellSize) * cellSize;
                const qrOffsetY = Math.round(((p.height - qrSize) / 2) / cellSize) * cellSize;
                const displayTextRow = Math.floor((qrOffsetY - cellSize * 4) / cellSize);
                const displayTextCols = Math.ceil(displayText.length * fontSize * 2 / cellSize); // フォントサイズ2倍に対応
                const displayTextStartCol = Math.floor(qrOffsetX / cellSize) + Math.floor(qrData.modules / 2) - Math.floor(displayTextCols / 2);
                if (j >= displayTextRow - 1 && j <= displayTextRow + 1 && 
                    i >= displayTextStartCol - 2 && i <= displayTextStartCol + displayTextCols + 2) {
                  isDisplayTextArea = true;
                }
              }
              if (isDisplayTextArea) continue;
              
              let x = i * cellSize + cellSize / 2;
              let y = j * cellSize + cellSize / 2;
              let cell = backgroundGrid[i][j];
              
              if (cell.active) {
                let pulse = p.sin(time * 2 + cell.phase) * 0.5 + 0.5;
                let alpha = cell.alpha + pulse * 40;
                let size = cell.baseSize + pulse * 2;
                
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
        }
        // Add other background effects as in original...
        
        p.pop();
      }
      
      function renderQR(target: any = p, isForExport: boolean = false) {
          if (!qrData) return;
          
          const { qr, modules } = qrData;
          
          // Center the QR code and align with background grid
          let qrSize = modules * cellSize;
          let offsetX = 0;
          let offsetY = 0;
          
          if (!isForExport) {
            offsetX = (p.width - qrSize) / 2;
            offsetY = (p.height - qrSize) / 2;
            
            // Snap to grid alignment
            offsetX = Math.round(offsetX / cellSize) * cellSize;
            offsetY = Math.round(offsetY / cellSize) * cellSize;
          }
          
          target.push();
          if (!isForExport) {
            target.translate(offsetX, offsetY);
          }
          
          for (let r = 0; r < modules; r++) {
            for (let c = 0; c < modules; c++) {
              let isDark = qr.isDark(r, c);
              let x = c * cellSize;
              let y = r * cellSize;
              
              let bgColor, fgColor;
              if (isDark) {
                bgColor = target.color(0, 0, 0);
                fgColor = target.color(255, 255, 255, 220);
              } else {
                if (isForExport) {
                  // Export時は背景透明
                  bgColor = target.color(255, 255, 255, 0); // 完全透明
                  fgColor = target.color(150, 150, 150, 60);
                } else {
                  bgColor = target.color(255, 255, 255);
                  fgColor = target.color(150, 150, 150, 60);
                }
              }
              
              if (isForExport && !isDark) {
                  // エクスポート時かつ明るいセル（背景）の場合は描画しない（透明にする場合）
                  // 文字だけ薄く描画する
              } else {
                  target.fill(bgColor);
                  target.noStroke();
                  target.rect(x, y, cellSize, cellSize);
              }
              
              let charIndex = (r * modules + c) % charSet.length;
              let ch = charSet[charIndex];
              
              target.fill(fgColor);
              // Graphicsオブジェクトの場合はtextSizeなどの設定が必要
              if (isForExport) {
                 target.textSize(cellSize); // cellSizeと同じサイズで
                 target.textAlign(target.CENTER, target.CENTER);
              } else {
                 target.textSize(fontSize);
              }
              
              target.text(ch, x + cellSize/2, y + cellSize/2);
            }
          }
          target.pop();
      }

      function drawGenerateButton() {
        if (!qrData) return;
        
        const qrSize = qrData.modules * cellSize;
        const offsetX = Math.round(((p.width - qrSize) / 2) / cellSize) * cellSize;
        const offsetY = Math.round(((p.height - qrSize) / 2) / cellSize) * cellSize;
        
        const textInputRow = Math.floor(offsetY / cellSize) - 2;
        const generateButtonCol = Math.floor(offsetX / cellSize) + Math.floor(qrData.modules / 2);
        const generateButtonRow = textInputRow + 1;
        
        if (generateButtonRow < 0) return;
        
        const buttonX = generateButtonCol * cellSize;
        const buttonY = generateButtonRow * cellSize;
        
        let mouseDistance = p.dist(p.mouseX, p.mouseY, buttonX + cellSize/2, buttonY + cellSize/2);
        let isHovered = mouseDistance < cellSize;
        
        p.push();
        
        // if (isHovered) {
        //   p.fill(255, 200, 100, 80);
        // } else {
        //   p.fill(255, 220, 150, 40);
        // }
        // p.noStroke();
        // p.rect(buttonX, buttonY, cellSize, cellSize);
        
        // if (isHovered) {
        //   p.fill(200, 100, 0, 220);
        // } else {
        //   p.fill(180, 120, 60, 160);
        // }
        
        // p.textSize(fontSize);
        // p.text('=', buttonX + cellSize/2, buttonY + cellSize/2);
        
        p.pop();
        
        p.generateButtonBounds = {
          x: buttonX,
          y: buttonY,
          width: cellSize,
          height: cellSize
        };
      }
      
      function drawNavigationButton(startX: number, startY: number) {
        if (!qrData) return;
        
        const navRow = Math.floor(startY / cellSize) + 2;
        const navCol = Math.floor(startX / cellSize) + Math.floor(qrData.modules / 2);
        
        const buttonX = navCol * cellSize;
        const buttonY = navRow * cellSize;
        
        const gridCol = Math.floor(buttonX / cellSize);
        const gridRow = Math.floor(buttonY / cellSize);
        
        if (gridCol >= 0 && gridCol < gridCols && gridRow >= 0 && gridRow < gridRows) {
          let mouseDistance = p.dist(p.mouseX, p.mouseY, buttonX + cellSize/2, buttonY + cellSize/2);
          let isHovered = mouseDistance < cellSize;
          
          p.push();
          
          if (isHovered) {
            p.fill(200, 200, 200, 30);
            p.noStroke();
            p.rect(buttonX, buttonY, cellSize, cellSize);
          }
          
          if (isHovered) {
            p.fill(100, 100, 100, 200);
          } else {
            p.fill(160, 160, 160, 120);
          }
          
          p.textSize(fontSize);
          p.text('＞', buttonX + cellSize/2, buttonY + cellSize/2);
          
          p.pop();
          
          p.navAreaBounds = {
            x: buttonX,
            y: buttonY,
            width: cellSize,
            height: cellSize
          };
        }
      }
      
      function drawDisplayText(qrStartX: number, qrStartY: number) {
        if (!displayText || !qrData) return;
        
        // QRコードの上にテキストを表示する位置を計算
        const textY = qrStartY - cellSize * 4; // QRコードの4行上（少し上に移動）
        const textX = qrStartX + (qrData.modules * cellSize / 2); // QRコードの中央
        
        // 背景を少し暗くして文字を見やすくする
        p.push();
        p.fill(0, 0, 0, 100);
        p.noStroke();
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(fontSize * 2); // フォントサイズを2倍に拡大
        
        // テキストの幅を測定して背景矩形を描画
        const textWidth = p.textWidth(displayText);
        const padding = cellSize * 0.8; // パディングも少し大きく
        p.fill(255, 255, 255, 220); // 背景をより不透明に
        p.rect(textX - textWidth/2 - padding, textY - fontSize - padding, 
               textWidth + padding * 2, fontSize * 2 + padding * 2);
        
        // テキストを描画
        p.fill(0, 0, 0, 255);
        p.text(displayText, textX, textY);
        
        p.pop();
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
          console.log('p.mousePressed called'); // Debug

          // Check if click is inside the footer
          const footerElement = document.querySelector('footer');
          if (footerElement) {
              const rect = footerElement.getBoundingClientRect();
              if (p.mouseX >= rect.left && p.mouseX <= rect.right && p.mouseY >= rect.top && p.mouseY <= rect.bottom) {
                  console.log('Click inside footer, allowing default behavior');
                  return true;
              }
          }

          // Button click logic as in original
          const toggleButton = document.querySelector('#toggleControls');
          if (toggleButton) {
              const rect = toggleButton.getBoundingClientRect();
              if (p.mouseX >= rect.left && p.mouseX <= rect.right && p.mouseY >= rect.top && p.mouseY <= rect.bottom) {
                  if (typeof window !== 'undefined' && (window as any).toggleSettings) {
                      (window as any).toggleSettings();
                  }
                  return false;
              }
          }

          if (showControls) {
              return true;
          }

          if (editableTextInstance && editableTextInstance.mousePressed(p)) {
              return false;
          }

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
          
          if (interactivity === 'ripple') {
            ripples.push({ x: p.mouseX, y: p.mouseY, size: 0, speed: 8, alpha: 255, decay: 5 });
          }
          return false;
      };

      // Make the generateQR function accessible from outside
      p.generateQR = function() {
        generateQR();
      };

      p.downloadQRImage = function() {
          if (!qrData) return;
          const { modules } = qrData;
          // Calculate needed size
          const size = modules * cellSize;
          
          let pg = p.createGraphics(size, size);
          
          // フォントなどの設定
          pg.textAlign(p.CENTER, p.CENTER);
          pg.textFont('monospace');
          pg.background(0, 0, 0, 0); // 透明背景で初期化
          
          // オフスクリーンバッファに描画
          renderQR(pg, true);
          
          // Imageとして保存
          p.save(pg, 'my-ascii-qr.png');
      };
      
      // Method to update the settings
      p.updateSettings = function() {
        isAnimating = animationSpeed > 0;
        initBackgroundGrid();
      };
      
      function generateQR() {
        if (!sessionId) return;

        const qr = qrcode(0, ecLevel as any);
        
        let qrCodeData: string;
        if (qrMode === 'text') {
          // In text mode, use the customQrData for the QR content,
          // and qrText (via charSet) for the visual representation.
          qrCodeData = customQrData || " ";
        } else {
          qrCodeData = `${location.origin}/join?s=${sessionId}`;
        }
        
        qr.addData(qrCodeData);
        qr.make();
        
        const modules = qr.getModuleCount();
        qrData = { qr, modules };
        
        initBackgroundGrid();
      }
    };

    // Create P5 instance and store reference
    p5Instance = new p5Constructor(sketch);
  }

  function updateSettings() {
    if (p5Instance && p5Instance.updateSettings) {
      p5Instance.updateSettings();
    }
  }

  function generateQR() {
    if (p5Instance && p5Instance.generateQR) {
      p5Instance.generateQR();
    }
  }

  function downloadOriginalQR() {
    console.log("Download button clicked");
    if (p5Instance && p5Instance.downloadQRImage) {
        console.log("Calling p5Instance.downloadQRImage");
        p5Instance.downloadQRImage();
    } else {
        console.error("p5Instance or downloadQRImage not available", !!p5Instance);
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
    if (qrText.toLowerCase().trim() === 'hint') {
      if (typeof window !== 'undefined') {
        window.location.href = '/hint';
      }
    } else {
      // トランジションアニメーションを開始
      isTransitioning = true;
      
      // 固定時間後にページ遷移を実行（アニメーション時間 + 少しの余裕）
      setTimeout(() => {
        const encodedKeyword = encodeURIComponent(qrText);
        goto(`/ascii/${encodedKeyword}`);
      }, 4300); // 4300ms（アニメーション4000ms + 余裕300ms）
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
    if (qrText !== undefined && !isCharSetManuallyEdited) {
      syncQrTextToCharSet();
    }
  }

  // Function to sync qrText characters to charSet
  function syncQrTextToCharSet() {
    if (qrText && qrText.length > 0) {
      const qrTextChars = [...new Set(qrText.split(''))];
      charSet = qrTextChars.join('');
    } else {
      charSet = '-';
    }
  }
  
  // Add keyboard event listener
  $: if (browser && typeof window !== 'undefined') {
    (window as any).navigateToAscii = navigateToAscii;
    (window as any).handleGenerateClick = generateQR;
    (window as any).toggleSettings = toggleSettings;
    (window as any).toggleQrMode = toggleQrMode;
  }
</script>

<div id="qrContainer" bind:this={qrContainer}></div>

<EditableText
  bind:this={editableTextInstance}
  bind:value={qrText}
  cellSize={cellSize}
  fontSize={fontSize}
/>

<footer>
    <a href="result?s={sessionId}">show result</a>
    <button class="secret-toggle" on:click={toggleQrMode} title="Toggle QR Mode">
        {qrMode === 'url' ? '🔗' : '📝'}
    </button>
    {#if qrMode === 'text'}
        <input type="text" bind:value={customQrData} on:input={generateQR} class="data-input" placeholder="QR Link/Data" />
    {/if}
    
    <div style="flex-grow: 1;"></div>
    
    <button class="save-button" on:click={downloadOriginalQR} title="Download Transparent QR">
        💾
    </button>
</footer>

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
    overflow: hidden;
  }

  #qrContainer {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }
    footer {
        position: fixed;
        bottom: 10px;
        left: 10px;
        padding: 5px 10px;
        border-radius: 5px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        z-index: 1000;
        display: flex;
        gap: 10px;
        align-items: center;
    }

    .secret-toggle {
        background: none;
        border: none;
        cursor: pointer;
        padding: 0;
        font-size: 1.2rem;
        opacity: 0.2;
        transition: opacity 0.2s;
    }
    
    .secret-toggle:hover {
        opacity: 1;
    }

    .data-input {
        background: rgba(255, 255, 255, 0.8);
        border: 1px solid #ccc;
        border-radius: 4px;
        padding: 4px 8px;
        font-size: 0.9rem;
        width: 200px;
        pointer-events: auto;
    }
    
    .save-button {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 1.2rem;
        padding: 5px;
        opacity: 0.6;
        transition: opacity 0.2s;
        pointer-events: auto;
    }
    
    .save-button:hover {
        opacity: 1;
        transform: scale(1.1);
    }
    
    .save-button:active {
        transform: scale(0.9);
        opacity: 0.8;
    }

</style>
