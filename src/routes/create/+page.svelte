<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import qrcode from 'qrcode-generator';
  import { doc, onSnapshot } from 'firebase/firestore';
  import { db } from '$lib/firebase';
  import EditableText from '$lib/component/EditableText.svelte'; 

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

  onMount(() => {
    console.log("Create page mounted with sessionId:", sessionId);

    if (!sessionId) {
      console.error('セッションIDが提供されていません');
      goto('/');
      return;
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
            
            const encodedKeyword = encodeURIComponent(latestMessage.text);
            console.log('answerページに遷移:', `/answer/${encodedKeyword}?s=${sessionId}`);
            
            // gotoを実行
            goto(`/answer/${encodedKeyword}?s=${sessionId}`);
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
        canvas.style('z-index', '1');
        
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
      
      function renderQR() {
          if (!qrData) return;
          
          const { qr, modules } = qrData;
          
          // Center the QR code and align with background grid
          let qrSize = modules * cellSize;
          let offsetX = (p.width - qrSize) / 2;
          let offsetY = (p.height - qrSize) / 2;
          
          // Snap to grid alignment
          offsetX = Math.round(offsetX / cellSize) * cellSize;
          offsetY = Math.round(offsetY / cellSize) * cellSize;
          
          p.push();
          p.translate(offsetX, offsetY);
          
          for (let r = 0; r < modules; r++) {
            for (let c = 0; c < modules; c++) {
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
        
        if (isHovered) {
          p.fill(255, 200, 100, 80);
        } else {
          p.fill(255, 220, 150, 40);
        }
        p.noStroke();
        p.rect(buttonX, buttonY, cellSize, cellSize);
        
        if (isHovered) {
          p.fill(200, 100, 0, 220);
        } else {
          p.fill(180, 120, 60, 160);
        }
        
        p.textSize(fontSize);
        p.text('=', buttonX + cellSize/2, buttonY + cellSize/2);
        
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
          qrCodeData = qrText;
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

  function downloadImage() {
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
    if (qrText.toLowerCase().trim() === 'hint') {
      if (typeof window !== 'undefined') {
        window.location.href = '/hint';
      }
    } else {
      const encodedKeyword = encodeURIComponent(qrText);
      goto(`/ascii/${encodedKeyword}`);
    }
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
</footer>




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
    }

</style>
