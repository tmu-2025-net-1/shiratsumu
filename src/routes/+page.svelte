<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { type ComponentType } from 'svelte';
  import type p5 from 'p5';
  import qrcode from 'qrcode-generator';

  let p5Instance: any;
  let p5Constructor: any;
  let qrContainer: HTMLDivElement;
  let qrData: { qr: any; modules: number } | null = null;
  
  // Settings with default values
  let cellSize = 20;
  let fontSize = 20;
  let animationSpeed = 0;
  let backgroundEffect = 'staticGrid';
  let interactivity = 'hover';
  let charSet = "ABCあいうえ◯▼잘자WXYZ0123456789";
  let qrText = "river";
  let ecLevel = "M";
  
  // Show controls toggle
  let showControls = false;
  
  // Grid-based text input
  let editingMode = false;
  let editingIndex = -1;
  let inputTextArray: string[] = [];
  let hiddenInputElement: HTMLInputElement;

  onMount(() => {
    let cleanup = () => {};
    
    // クライアントサイドのみでp5をロードする
    if (browser) {
      // 動的にp5をインポート (非同期ではあるが、onMount内で完結)
      import('p5').then(p5Module => {
        p5Constructor = p5Module.default;
        
        // Initialize P5 sketch
        initP5Sketch();
      });
      
      // クリーンアップ関数
      cleanup = () => {
        // Cleanup P5 instance on component unmount
        if (p5Instance) {
          p5Instance.remove();
        }
      };
    }
    
    return cleanup;
  });

  function initP5Sketch() {
    if (!p5Constructor) return;
    
    // Define the P5.js sketch
    const sketch = (p: any) => {
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
      
      p.setup = function() {
        const canvas = p.createCanvas(p.windowWidth, p.windowHeight);
        canvas.parent(qrContainer);
        p.textAlign(p.CENTER, p.CENTER);
        p.textFont('monospace');
        
        // Make sure canvas doesn't interfere with UI controls
        canvas.style('z-index', '1');
        
        // Initialize background grid
        initBackgroundGrid();
        
        // Generate initial QR code
        generateQR();
      };
      
      p.windowResized = function() {
        p.resizeCanvas(p.windowWidth, p.windowHeight);
        initBackgroundGrid();
      };
      
      p.draw = function() {
        // Update time based on animation speed
        if (animationSpeed > 0) {
          time += 0.01 + (animationSpeed / 100) * 0.05;
        } else {
          time += 0.005; // Very slow movement even when stopped
        }
        
        // Clear background - white background
        p.background(255, 255, 255);
        
        // Draw background grid effect
        drawBackgroundGrid();
        
        // Draw QR code
        if (qrData) {
          drawQR();
        }
        
        // Draw ripples
        drawRipples();
        
        // Update ripples
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
      
      function drawBackgroundGrid() {
        if (backgroundEffect === 'none') return;
        
        p.push();
        
        // Get navigation button position to skip drawing character there
        let navButtonGridCol = -1, navButtonGridRow = -1;
        let textInputStartCol = -1, textInputStartRow = -1;
        let generateButtonCol = -1, generateButtonRow = -1;
        
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
          textInputStartCol = textInputStartColNum;
          textInputStartRow = textInputRow;
          
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
              if (textInputStartRow >= 0 && j === textInputStartRow) {
                for (let k = 0; k < inputTextArray.length + 1; k++) {
                  if (i === textInputStartCol + k) {
                    isTextInputArea = true;
                    break;
                  }
                }
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
              if (textInputStartRow >= 0 && j === textInputStartRow) {
                for (let k = 0; k < inputTextArray.length + 1; k++) {
                  if (i === textInputStartCol + k) {
                    isTextInputArea = true;
                    break;
                  }
                }
              }
              if (isTextInputArea) continue;
              
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
              if (textInputStartRow >= 0 && j === textInputStartRow) {
                for (let k = 0; k < inputTextArray.length + 1; k++) {
                  if (i === textInputStartCol + k) {
                    isTextInputArea = true;
                    break;
                  }
                }
              }
              if (isTextInputArea) continue;
              
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
              if (textInputStartRow >= 0 && j === textInputStartRow) {
                for (let k = 0; k < inputTextArray.length + 1; k++) {
                  if (i === textInputStartCol + k) {
                    isTextInputArea = true;
                    break;
                  }
                }
              }
              if (isTextInputArea) continue;
              
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
      
      function drawQR() {
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
        
        // QR code blends seamlessly with background - no separate background
        for (let r = 0; r < modules; r++) {
          for (let c = 0; c < modules; c++) {
            let isDark = qr.isDark(r, c);
            let x = c * cellSize;
            let y = r * cellSize;
            
            // Mouse interaction
            let mouseDistance = p.dist(p.mouseX - offsetX, p.mouseY - offsetY, x + cellSize/2, y + cellSize/2);
            let cellInfluence = 0;
            
            if (interactivity === 'hover' && mouseDistance < cellSize * 2) {
              cellInfluence = p.map(mouseDistance, 0, cellSize * 2, 1, 0);
            } else if (interactivity === 'glow' && mouseDistance < cellSize * 3) {
              cellInfluence = p.map(mouseDistance, 0, cellSize * 3, 0.8, 0);
            }
            
            // More seamless colors - subtle difference from background
            let bgColor, fgColor;
            if (isDark) {
              bgColor = p.color(0, 0, 0); // Black background for dark cells
              fgColor = p.color(255, 255, 255, 220); // White characters
            } else {
              bgColor = p.color(255, 255, 255); // White background for light cells
              fgColor = p.color(150, 150, 150, 60); // Very light gray characters
            }
            
            if (cellInfluence > 0) {
              if (isDark) {
                bgColor = p.lerpColor(p.color(0, 0, 0), p.color(50, 50, 150), cellInfluence);
                fgColor = p.lerpColor(p.color(255, 255, 255, 220), p.color(255, 255, 100), cellInfluence);
              } else {
                bgColor = p.lerpColor(p.color(255, 255, 255), p.color(200, 200, 255), cellInfluence);
                fgColor = p.lerpColor(p.color(150, 150, 150, 60), p.color(50, 50, 200), cellInfluence);
              }
            }
            
            // Draw background
            p.fill(bgColor);
            p.noStroke();
            p.rect(x, y, cellSize, cellSize);
            
            // Draw character
            let charIndex = isAnimating ? 
              Math.floor(p.random(charSet.length)) : 
              (r * modules + c) % charSet.length;
            let ch = charSet[charIndex];
            
            p.fill(fgColor);
            p.textSize(fontSize + cellInfluence * 4);
            p.text(ch, x + cellSize/2, y + cellSize/2);
          }
        }
        
        p.pop();
        
        // Draw text input area
        drawTextInputArea();
        
        // Draw generate button
        drawGenerateButton();
        
        // Draw navigation button as part of the grid below QR code
        drawNavigationButton(offsetX, offsetY + qrSize);
      }
      
      function drawTextInputArea() {
        if (!qrData) return;
        
        const qrSize = qrData.modules * cellSize;
        const offsetX = Math.round(((p.width - qrSize) / 2) / cellSize) * cellSize;
        const offsetY = Math.round(((p.height - qrSize) / 2) / cellSize) * cellSize;
        
        const textInputRow = Math.floor(offsetY / cellSize) - 2;
        const textInputStartColNum = Math.floor(offsetX / cellSize);
        
        if (textInputRow < 0) return; // Skip if not enough space above QR code
        
        p.push();
        
        // Draw text input cells
        for (let i = 0; i < inputTextArray.length; i++) {
          const cellX = (textInputStartColNum + i) * cellSize;
          const cellY = textInputRow * cellSize;
          
          // Mouse interaction
          let mouseDistance = p.dist(p.mouseX, p.mouseY, cellX + cellSize/2, cellY + cellSize/2);
          let isHovered = mouseDistance < cellSize;
          let isEditing = editingMode && editingIndex === i;
          
          // Draw cell background
          if (isEditing) {
            p.fill(100, 150, 255, 60); // Blue when editing
          } else if (isHovered) {
            p.fill(200, 200, 200, 40); // Light gray on hover
          } else {
            p.fill(240, 240, 240, 30); // Very light background
          }
          p.noStroke();
          p.rect(cellX, cellY, cellSize, cellSize);
          
          // Draw character
          if (isEditing) {
            p.fill(0, 100, 200, 220); // Blue text when editing
          } else if (isHovered) {
            p.fill(100, 100, 100, 200); // Darker on hover
          } else {
            p.fill(120, 120, 120, 160); // Normal gray
          }
          
          p.textSize(fontSize);
          p.text(inputTextArray[i], cellX + cellSize/2, cellY + cellSize/2);
          
          // Store bounds for click detection
          if (!p.textInputBounds) p.textInputBounds = [];
          p.textInputBounds[i] = {
            x: cellX,
            y: cellY,
            width: cellSize,
            height: cellSize,
            index: i
          };
        }
        
        // Draw add new character cell ('+' cell)
        const addCellX = (textInputStartColNum + inputTextArray.length) * cellSize;
        const addCellY = textInputRow * cellSize;
        
        let addMouseDistance = p.dist(p.mouseX, p.mouseY, addCellX + cellSize/2, addCellY + cellSize/2);
        let addIsHovered = addMouseDistance < cellSize;
        
        if (addIsHovered) {
          p.fill(150, 255, 150, 60); // Light green on hover
        } else {
          p.fill(200, 255, 200, 30); // Very light green
        }
        p.noStroke();
        p.rect(addCellX, addCellY, cellSize, cellSize);
        
        // Draw '+' character
        if (addIsHovered) {
          p.fill(0, 150, 0, 200); // Dark green on hover
        } else {
          p.fill(100, 180, 100, 160); // Light green
        }
        p.textSize(fontSize);
        p.text('+', addCellX + cellSize/2, addCellY + cellSize/2);
        
        // Store add button bounds
        if (!p.textInputBounds) p.textInputBounds = [];
        p.textInputBounds[inputTextArray.length] = {
          x: addCellX,
          y: addCellY,
          width: cellSize,
          height: cellSize,
          index: inputTextArray.length,
          isAddButton: true
        };
        
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
        
        if (generateButtonRow < 0) return; // Skip if not enough space
        
        const buttonX = generateButtonCol * cellSize;
        const buttonY = generateButtonRow * cellSize;
        
        // Mouse interaction
        let mouseDistance = p.dist(p.mouseX, p.mouseY, buttonX + cellSize/2, buttonY + cellSize/2);
        let isHovered = mouseDistance < cellSize;
        
        p.push();
        
        // Draw button background
        if (isHovered) {
          p.fill(255, 200, 100, 80); // Orange on hover
        } else {
          p.fill(255, 220, 150, 40); // Light orange
        }
        p.noStroke();
        p.rect(buttonX, buttonY, cellSize, cellSize);
        
        // Draw '=' character
        if (isHovered) {
          p.fill(200, 100, 0, 220); // Dark orange on hover
        } else {
          p.fill(180, 120, 60, 160); // Orange
        }
        
        p.textSize(fontSize);
        p.text('=', buttonX + cellSize/2, buttonY + cellSize/2);
        
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
        // Skip if mouse is over UI controls
        if (showControls) {
          const controlsEl = document.querySelector('.controls-panel');
          if (controlsEl) {
            const rect = controlsEl.getBoundingClientRect();
            if (
              p.mouseX >= rect.left && p.mouseX <= rect.right &&
              p.mouseY >= rect.top && p.mouseY <= rect.bottom
            ) {
              return true; // Allow DOM event handling
            }
          }
        }
        
        // Also check for the toggle button
        const toggleButton = document.querySelector('#toggleControls');
        if (toggleButton) {
          const rect = toggleButton.getBoundingClientRect();
          if (
            p.mouseX >= rect.left && p.mouseX <= rect.right &&
            p.mouseY >= rect.top && p.mouseY <= rect.bottom
          ) {
            return true; // Allow DOM event handling
          }
        }
        
        // Check text input area clicks
        if (p.textInputBounds) {
          for (let i = 0; i < p.textInputBounds.length; i++) {
            const bounds = p.textInputBounds[i];
            if (bounds && 
                p.mouseX >= bounds.x && p.mouseX <= bounds.x + bounds.width &&
                p.mouseY >= bounds.y && p.mouseY <= bounds.y + bounds.height) {
              
              if (bounds.isAddButton) {
                // Add new character
                if (typeof window !== 'undefined' && (window as any).handleTextGridClick) {
                  (window as any).handleTextGridClick(bounds.index);
                }
              } else {
                // Edit existing character
                if (typeof window !== 'undefined' && (window as any).handleTextGridClick) {
                  (window as any).handleTextGridClick(bounds.index);
                }
              }
              return false;
            }
          }
        }
        
        // Check generate button click
        if (p.generateButtonBounds) {
          const bounds = p.generateButtonBounds;
          if (
            p.mouseX >= bounds.x && p.mouseX <= bounds.x + bounds.width &&
            p.mouseY >= bounds.y && p.mouseY <= bounds.y + bounds.height
          ) {
            // Generate QR code
            if (typeof window !== 'undefined' && (window as any).handleGenerateClick) {
              (window as any).handleGenerateClick();
            }
            return false;
          }
        }
        
        // Check if click is in navigation area
        if (p.navAreaBounds && qrData) {
          const bounds = p.navAreaBounds;
          if (
            p.mouseX >= bounds.x && p.mouseX <= bounds.x + bounds.width &&
            p.mouseY >= bounds.y && p.mouseY <= bounds.y + bounds.height
          ) {
            // Navigate to ASCII page with qrText as keyword
            if (typeof window !== 'undefined' && (window as any).navigateToAscii) {
              (window as any).navigateToAscii();
            }
            return false;
          }
        }
        
        // Handle ripple effect
        if (interactivity === 'ripple') {
          ripples.push({
            x: p.mouseX,
            y: p.mouseY,
            size: 0,
            speed: 8,
            alpha: 255,
            decay: 5
          });
        }
        return false;
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
        // QRコードのエラー修正レベルを適切に設定
        const qr = qrcode(0, ecLevel as any);
        qr.addData(qrText);
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

  // Watch for changes in settings
  $: if (p5Instance) {
    updateSettings();
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
      const encodedKeyword = encodeURIComponent(qrText);
      goto(`/ascii/${encodedKeyword}`);
    }
  }
  
  // Make navigation function available globally for p5.js
  $: if (browser && typeof window !== 'undefined') {
    (window as any).navigateToAscii = navigateToAscii;
  }
  
  // Initialize input text array from qrText
  $: {
    if (!editingMode) {
      inputTextArray = qrText.split('');
    }
  }
  
  // Handle text input grid clicks
  function handleTextGridClick(index: number) {
    editingMode = true;
    editingIndex = index;
    
    // Focus on hidden input for better text input experience
    if (hiddenInputElement) {
      hiddenInputElement.value = qrText;
      hiddenInputElement.focus();
      
      // Set cursor position to the clicked character
      if (index < qrText.length) {
        hiddenInputElement.setSelectionRange(index, index);
      } else {
        hiddenInputElement.setSelectionRange(qrText.length, qrText.length);
      }
    }
  }
  
  // Handle keyboard input for editing
  function handleKeyInput(event: KeyboardEvent) {
    if (editingMode && event.key === 'Escape') {
      event.preventDefault();
      editingMode = false;
      editingIndex = -1;
      if (hiddenInputElement) {
        // Ensure final value is synced before blur
        const finalValue = hiddenInputElement.value;
        qrText = finalValue;
        inputTextArray = finalValue.split('');
        generateQR();
        hiddenInputElement.blur();
      }
    }
    // Let the hidden input handle all other typing
  }
  
  // Handle hidden input changes
  function handleHiddenInputChange() {
    if (editingMode && hiddenInputElement) {
      const newValue = hiddenInputElement.value;
      qrText = newValue;
      inputTextArray = newValue.split('');
      generateQR();
    }
  }
  
  // Handle hidden input blur (when focus is lost)
  function handleHiddenInputBlur() {
    editingMode = false;
    editingIndex = -1;
    // Ensure final sync when editing ends
    if (hiddenInputElement) {
      const finalValue = hiddenInputElement.value;
      qrText = finalValue;
      inputTextArray = finalValue.split('');
      generateQR();
    }
  }
  
  // Add keyboard event listener
  $: if (browser && typeof window !== 'undefined') {
    (window as any).navigateToAscii = navigateToAscii;
    (window as any).handleTextGridClick = handleTextGridClick;
    (window as any).handleGenerateClick = generateQR;
    
    // Remove previous listener if it exists
    if ((window as any).keyInputHandler) {
      window.removeEventListener('keydown', (window as any).keyInputHandler);
    }
    
    // Add new listener
    (window as any).keyInputHandler = handleKeyInput;
    window.addEventListener('keydown', handleKeyInput);
  }
</script>

<div id="qrContainer" bind:this={qrContainer}></div>

<!-- Hidden input for better text editing experience -->
<input
  type="text"
  bind:this={hiddenInputElement}
  on:input={handleHiddenInputChange}
  on:blur={handleHiddenInputBlur}
  style="position: absolute; left: -9999px; opacity: 0; pointer-events: none;"
  autocomplete="off"
/>

<button id="toggleControls" on:click={() => showControls = !showControls}>
  ⚙️ Settings
</button>

<div class="controls-panel" class:show={showControls}>
  <div>
    <label for="qrText">Text to encode</label>
    <textarea id="qrText" rows="2" placeholder="Enter text..." bind:value={qrText}></textarea>

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

    <label for="charSet">Characters</label>
    <input type="text" id="charSet" bind:value={charSet}>

    <label for="animationSpeed">Speed: {animationSpeed}</label>
    <input type="range" id="animationSpeed" min="0" max="100" bind:value={animationSpeed}>

    <button on:click={generateQR}>Generate</button>
    <button on:click={downloadImage}>Download</button>
  </div>
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    background: #000;
    overflow: hidden;
  }

  #qrContainer {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
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

  #toggleControls {
    position: fixed;
    top: 10px;
    right: 10px;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    border: none;
    padding: 8px 12px;
    border-radius: 4px;
    cursor: pointer;
    z-index: 2001;
    font-size: 12px;
    pointer-events: auto;
  }
</style>
