<script lang="ts">
  // p5プロパティは削除し、各関数が引数でpを受け取る形
  export let value: string;
  export let x: number = 0;
  export let y: number = 0;
  export let cellSize: number = 15;
  export let fontSize: number = 15;
  export let showAddButton: boolean = true;
  export let textColor = '#333';
  export let backgroundColor = 'rgba(240, 240, 240, 0.3)';
  export let hoverBackgroundColor = 'rgba(200, 200, 200, 0.4)';
  export let editingBackgroundColor = 'rgba(100, 150, 255, 0.6)';

  let editingMode = false;
  let hiddenInputElement: HTMLInputElement;
  let inputTextArray: string[] = [];
  let bounds: Array<{ x: number, y: number, width: number, height: number, index?: number, isAddButton?: boolean }> = [];

  $: inputTextArray = value ? value.split('') : [];

  /**
   * 描画関数：引数でp5インスタンス(p)を受け取る
   */
  export function draw(p: any, newX: number, newY: number) {
    // ★受け取った座標をコンポーネントのx, yプロパティに即座に反映
    x = newX;
    y = newY;

    if (!p) return;
    bounds = []; 

    p.push();
    p.textSize(fontSize);
    
    for (let i = 0; i < inputTextArray.length; i++) {
      const charX = x + i * cellSize;
      const isHovered = p.mouseX > charX && p.mouseX < charX + cellSize && p.mouseY > y && p.mouseY < y + cellSize;
      const isEditing = editingMode && i === (inputTextArray.length - 1);

      p.fill(isEditing ? editingBackgroundColor : isHovered ? hoverBackgroundColor : backgroundColor);
      p.noStroke();
      p.rect(charX, y, cellSize, cellSize);

      p.fill(textColor);
      p.text(inputTextArray[i], charX + cellSize / 2, y + cellSize / 2);

      bounds.push({ x: charX, y, width: cellSize, height: cellSize, index: i });
    }

    if (showAddButton) {
      const addCellX = x + inputTextArray.length * cellSize;
      const isHovered = p.mouseX > addCellX && p.mouseX < addCellX + cellSize && p.mouseY > y && p.mouseY < y + cellSize;

      p.fill(isHovered ? 'rgba(150, 255, 150, 0.6)' : 'rgba(200, 255, 200, 0.3)');
      p.noStroke();
      p.rect(addCellX, y, cellSize, cellSize);
      p.fill(isHovered ? '#090' : '#5A5');
      p.text('+', addCellX + cellSize / 2, y + cellSize / 2);
      bounds.push({ x: addCellX, y, width: cellSize, height: cellSize, isAddButton: true });
    }

    p.pop();
  }

  /**
   * クリック処理関数：引数でp5インスタンス(p)を受け取る
   */
  export function mousePressed(p: any): boolean {
    if (!p) return false;
    
    for (const bound of bounds) {
      if (p.mouseX > bound.x && p.mouseX < bound.x + bound.width && p.mouseY > bound.y && p.mouseY < bound.y + bound.height) {
        startEditing();
        return true;
      }
    }
    return false;
  }

  function startEditing() {
    editingMode = true;
    if (hiddenInputElement) {
      hiddenInputElement.value = value;
      hiddenInputElement.focus();
      hiddenInputElement.setSelectionRange(value.length, value.length);
    }
  }

  function handleHiddenInputChange() {
    if (hiddenInputElement) {
      value = hiddenInputElement.value;
    }
  }

  function handleHiddenInputBlur() {
    editingMode = false;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === 'Escape') {
      hiddenInputElement.blur();
    }
  }
</script>

<input
  type="text"
  bind:this={hiddenInputElement}
  on:input={handleHiddenInputChange}
  on:blur={handleHiddenInputBlur}
  on:keydown={handleKeydown}
  style="position: absolute; left: -9999px; opacity: 0; pointer-events: none;"
  autocomplete="off"
/>