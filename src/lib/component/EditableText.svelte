<script lang="ts">
  export let value: string;
  export let x: number = 0;
  export let y: number = 0;
  export let cellSize: number = 15;
  export let fontSize: number = 15;
  export let showAddButton: boolean = true;
  export let textColor = '#333'; 
  export let backgroundColor = 'transparent';
  export let hoverBackgroundColor = 'rgba(200, 200, 200, 0.4)';
  export let editingBackgroundColor = 'rgba(100, 150, 255, 0.6)';
  
  // しりとり機能用のプロパティ
  export let isShiritoriMode: boolean = false;
  export let initialValue: string = '';
  export let onSubmit: ((value: string) => void) | null = null;
  export let sessionId: string | null = null; // セッションIDを追加

  let editingMode = false;
  
  // 編集状態を親コンポーネントに公開
  export { editingMode as isEditing };
  
  let hiddenInputElement: HTMLInputElement;
  let inputTextArray: string[] = [];
  let bounds: Array<{ x: number, y: number, width: number, height: number, index?: number, isAddButton?: boolean, isSubmitButton?: boolean }> = [];

  // セッションIDが渡された場合はログに出力
  $: if (sessionId) {
    console.log('EditableText: セッションID受信:', sessionId);
  }

  $: inputTextArray = value ? value.split('') : [];
  
  // しりとり機能用のリアクティブ計算
  $: lastCharOfInitial = initialValue ? initialValue.slice(-1).toLowerCase() : '';
  
  // 追記モード: 最後の文字から新しい単語を作成している状態
  $: isInAppendMode = isShiritoriMode && initialValue && value && 
     value.toLowerCase().startsWith(lastCharOfInitial) && 
     value.length > initialValue.length;
  
  // 送信可能: 追記モードで3文字以上
  $: isSubmittable = isShiritoriMode && initialValue && value && 
     value.toLowerCase().startsWith(lastCharOfInitial) && 
    //  value.length > initialValue.length && 
     value.length >= 3;

  // 編集状態の詳細情報を親に提供
  export const getEditingStatus = () => {
    if (!isShiritoriMode || !editingMode) return null;
    
    const currentLength = value ? value.length : 0;
    const lastChar = lastCharOfInitial;
    
    // 最初に表示された状態かつ．最後の文字で始まっていない場合
    if (value === initialValue || !value.toLowerCase().startsWith(lastChar)) {
      return {
        type: 'initial',
        message: "Found it, nice work. Try deleting all characters.", // English: "Found it, nice work. Try deleting all characters.",
        lastChar
      };
    }
    
    // 完全に一文字になった時（最後の文字のみの状態）
    if (currentLength === 1 && value === lastChar) {
      return {
        type: 'one-char',
        message: `Great job. The first word is '${lastChar}'.`,
        lastChar
      };
    }
    
    // 3文字未満（一文字の状態から文字を追加し始めた時）
    if (currentLength < 3 && currentLength > 1) {
      // 最後の文字で始まっているかチェック
      if (value.toLowerCase().startsWith(lastChar)) {
        return {
          type: 'too-short',
          message: `What is a word of three or more characters starting with "${lastChar}"?`,
          lastChar
        };
      }
    }
    
    // 3文字以上（送信可能）
    if (isSubmittable) {
      return {
        type: 'ready-to-submit',
        message: `You can send the word by pressing Enter or ">".`,
        lastChar
      };
    }
    
    return null;
  };

  
  // 値の変化を確実に検知するためのリアクティブステート
  $: {
    // 値の変化時に必要な処理を実行
    const currentLength = value ? value.length : 0;
    const hasValue = value && value.trim() !== '';
    
    // しりとりモードで最後の文字以下になったら最後の文字のみに制限
    if (isShiritoriMode && initialValue && value !== undefined) {
      if (value.length === 0 || (value.length === 1 && value.toLowerCase() !== lastCharOfInitial)) {
        // 完全に削除されたか、最後の文字以外になった場合は最後の文字のみに戻す
        value = lastCharOfInitial;
      }
    }
  }

  /**
   * 描画関数：引数でp5インスタンス(p)を受け取る
   */
  export function draw(p: any, newX: number, newY: number, newCellSize: number) {
    // ★受け取った座標をコンポーネントのx, yプロパティに即座に反映
    x = newX;
    y = newY;
    cellSize = newCellSize;
    fontSize = newCellSize;

    if (!p) return;
    bounds = [];

    // 現在の値を明示的に参照して、リアクティブな依存関係を確立
    const currentValue = value || '';
    const currentArray = currentValue.split('');

    p.push();
    p.textSize(fontSize);
    p.textAlign(p.CENTER, p.CENTER); // ASCIIアートと同じテキスト配置
    
    for (let i = 0; i < currentArray.length; i++) {
      const charX = x + i * cellSize;
      const isHovered = p.mouseX > charX && p.mouseX < charX + cellSize && p.mouseY > y && p.mouseY < y + cellSize;
      const isEditing = editingMode && i === (currentArray.length - 1);
      const char = currentArray[i];

      // 空の文字や空白文字の場合は背景を描画しない
      if (char && char.trim() !== '') {
        p.fill(isEditing ? editingBackgroundColor : isHovered ? hoverBackgroundColor : backgroundColor);
        p.noStroke();
        p.rect(charX, y, cellSize, cellSize);

        p.fill(textColor);
        p.text(char, charX + cellSize / 2, y + cellSize / 2);
      }

      bounds.push({ x: charX, y, width: cellSize, height: cellSize, index: i });
    }

    if (showAddButton) {
      const addCellX = x + currentArray.length * cellSize;
      const isHovered = p.mouseX > addCellX && p.mouseX < addCellX + cellSize && p.mouseY > y && p.mouseY < y + cellSize;

      p.fill(isHovered ? 'rgba(255, 180, 80, 0.7)' : 'rgba(255, 200, 120, 0.4)');
      p.noStroke();
      p.rect(addCellX, y, cellSize, cellSize);
      p.fill(isHovered ? 'orange' : '#FFA500');
      p.text('+', addCellX + cellSize / 2, y + cellSize / 2);
      bounds.push({ x: addCellX, y, width: cellSize, height: cellSize, isAddButton: true });
    }

    // しりとりモードでsubmitボタンを表示
    if (isShiritoriMode && editingMode) {
      const submitCellX = x + currentArray.length * cellSize + (showAddButton ? cellSize : 0);
      const isHovered = p.mouseX > submitCellX && p.mouseX < submitCellX + cellSize && p.mouseY > y && p.mouseY < y + cellSize;
      
      // 送信可能かどうかで色を変更
      const canSubmit = isSubmittable;
      console.log('Submit button render:', { canSubmit, isSubmittable, value, length: value?.length }); // デバッグ
      const bgColor = canSubmit
        ? (isHovered ? 'rgba(255, 140, 0, 0.85)' : 'rgba(255, 165, 0, 0.7)') // 送信可能な場合はオレンジ系
        : (isHovered ? 'rgba(200, 150, 80, 0.6)' : 'rgba(180, 120, 60, 0.4)'); // 送信不可は薄いオレンジ/茶系
      const textColorForButton = canSubmit ? '#FFF' : '#999';

      p.fill(bgColor);
      p.noStroke();
      p.rect(submitCellX, y, cellSize, cellSize);
      p.fill(textColorForButton);
      p.text('>', submitCellX + cellSize / 2, y + cellSize / 2);
      bounds.push({ x: submitCellX, y, width: cellSize, height: cellSize, isSubmitButton: true });
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
        if (bound.isSubmitButton) {
          // submitボタンがクリックされた場合
          if (isSubmittable && onSubmit) {
            onSubmit(value);
            editingMode = false; // 編集モードを終了
            return true;
          }
          return true; // クリックは処理したが、送信はしない
        } else {
          // 通常の編集開始
          startEditing();
          return true;
        }
      }
    }
    return false;
  }

  function startEditing() {
    editingMode = true;
    if (hiddenInputElement) {
      hiddenInputElement.value = value;
      hiddenInputElement.focus();
      
      // しりとりモードで追記モードの場合、カーソルを末尾に設定
      // そうでなければ、末尾に設定（削除可能な位置）
      if (isShiritoriMode && isInAppendMode) {
        hiddenInputElement.setSelectionRange(value.length, value.length);
      } else {
        hiddenInputElement.setSelectionRange(value.length, value.length);
      }
    }
  }

  function handleHiddenInputChange() {
    if (hiddenInputElement) {
      let newValue = hiddenInputElement.value;
      
      // しりとりモードでの制限を適用
      if (isShiritoriMode && initialValue) {
        // 完全に削除されたか、最後の文字より短くなった場合は最後の文字のみに制限
        if (newValue.length === 0 || (newValue.length === 1 && newValue.toLowerCase() !== lastCharOfInitial)) {
          newValue = lastCharOfInitial;
          hiddenInputElement.value = newValue;
        }
        // 追記モードでない場合（元の単語から削除中）は最後の文字までしか削除できない
        else if (newValue.length < lastCharOfInitial.length) {
          newValue = lastCharOfInitial;
          hiddenInputElement.value = newValue;
        }
      }
      
      value = newValue;
    }
  }

  function handleHiddenInputBlur() {
    editingMode = false;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      if (isShiritoriMode && isSubmittable && onSubmit) {
        // しりとりモードで送信可能な場合は送信
        onSubmit(value);
        editingMode = false;
      } else {
        // 通常モードまたは送信不可の場合は編集終了
        hiddenInputElement.blur();
      }
    } else if (event.key === 'Escape') {
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
  style="position: fixed; top: 0; left: 0; width: 1px; height: 1px; opacity: 0; pointer-events: none; z-index: -1; font-size: 16px;"
  autocomplete="off"
  inputmode="text"
/>