<script lang="ts">

import { onMount } from 'svelte';

import EditableText from '$lib/component/EditableText.svelte';

import { doc, updateDoc, runTransaction, getDoc } from 'firebase/firestore';

import { db } from '$lib/firebase';



export let data: {

img: string;

alt: string;

q: string;

chars: string;

sessionId: string | null; // セッションIDを追加

};



let container: HTMLDivElement;


// ズーム関連の変数

let zoom = 1;

let panX = 0;

let panY = 0;

let isDragging = false;

let lastX = 0;

let lastY = 0;





// ズームリセット関数

function resetZoom() {

zoom = 1;

panX = 0;

panY = 0;

if (p5Instance) p5Instance.needsRedraw = true;

}



// ズームイン/アウト関数

function zoomIn() {

zoom = Math.min(5, zoom + 0.2);

if (p5Instance) p5Instance.needsRedraw = true;

}



function zoomOut() {

zoom = Math.max(0.5, zoom - 0.2);

if (p5Instance) p5Instance.needsRedraw = true;

}



let p5Instance: any;

let editableTextInstance: EditableText; // ★2. インスタンスを保持

let editableTextValue = data.q; // ★2. テキストの値を保持（data.qで初期化）


// 初回クリック状態を管理する変数

let hasBeenClicked = false;

// let dynamicTextColor = "rgba(137, 137, 137, 0.8)";

let dynamicTextColor = "rgba(255, 0, 0, 0.8)";//テスト用に赤く(これはpush時に削除)

let dynamicShowAddButton = false;


// 編集状態を管理する変数

let isEditingText = false;



// しりとり機能用の変数

let initialWord = data.q; // 初期の単語を保存


// ページロード時の会話の長さを記録（このページから送信するメッセージのID決定用）

let targetMessageId: number | null = null;


// しりとり送信処理

async function handleShiritoriSubmit(newValue: string) {

console.log('しりとり送信:', newValue);


// targetMessageIdが設定されていない場合は送信しない

if (targetMessageId === null) {

alert('まだ初期化が完了していません。少し待ってから再試行してください。');

return;

}


// セッションIDが存在する場合のみFirestoreに記録

if (data.sessionId) {

try {

const sessionRef = doc(db, 'sessions', data.sessionId);


// トランザクションを使って安全に更新

const result = await runTransaction(db, async (transaction) => {

const sessionDoc = await transaction.get(sessionRef);

if (!sessionDoc.exists()) {

console.error('セッションが見つかりません:', data.sessionId);

return { success: false, message: 'セッションが見つかりません' };

}



const currentData = sessionDoc.data();

const conversation = currentData.conversation || [];


// 指定されたIDのユーザーメッセージが既に存在するかチェック

const hasTargetResponse = conversation.some((msg: { id: number, sender: string, text: string }) => msg.id === targetMessageId && msg.sender === "user");


if (hasTargetResponse) {

// 既に他のユーザーが回答済み

return { success: false, message: '残念！他の人が先に回答しました。' };

}


// 新しいメッセージを追加（ページロード時に決定したIDで送信）

const newMessage = {

id: targetMessageId,

sender: "user",

text: newValue,

updatedAt: new Date()

};


conversation.push(newMessage);


// Firestoreを更新

transaction.update(sessionRef, {

conversation: conversation,

updatedAt: new Date()

});


return { success: true, message: 'success' };

});


if (result.success) {

console.log('Firestoreに送信完了:', newValue);

alert(result.message); // "success"を表示

} else {

console.log('送信失敗:', result.message);

alert(result.message); // "残念！他の人が先に回答しました。"を表示

return; // 失敗時はローカル状態を更新しない

}


} catch (error) {

console.error('Firestore送信エラー:', error);

alert('送信中にエラーが発生しました。');

return; // エラー時はローカル状態を更新しない

}

} else {

console.log('セッションIDが無いため、Firestoreには記録しません');

}


// 成功時のみ値を更新（ローカル状態の更新）

editableTextValue = newValue;

}



// 初回クリック時の処理

function handleFirstClick() {

if (!hasBeenClicked) {

hasBeenClicked = true;

dynamicTextColor = "white";

dynamicShowAddButton = true;

}

}



// EditableTextの値の変化を監視

$: {

// 値の変化を確実に検知するためのダミー計算

const valueLength = editableTextValue.length;

const charArray = editableTextValue.split('');


if (p5Instance && p5Instance.needsRedraw !== undefined) {

p5Instance.needsRedraw = true; // 値が変更されたら再描画

// 微小な遅延を追加して同期を保つ

setTimeout(() => {

if (p5Instance && p5Instance.needsRedraw !== undefined) {

p5Instance.needsRedraw = true;

}

}, 0);

}

}



// ★3. コンポーネントの位置を保持

let editableTextX = 0;

let editableTextY = 0;

let editableTextCellSize = 0;



onMount(() => {

// セッションIDが存在する場合、ページロード時に現在の会話の長さを取得

if (data.sessionId) {

const sessionRef = doc(db, 'sessions', data.sessionId);

getDoc(sessionRef).then(docSnap => {

if (docSnap.exists()) {

const currentData = docSnap.data();

const conversation = currentData.conversation || [];

// このページから送信するメッセージのIDを決定

targetMessageId = conversation.length + 1;

console.log('ページロード時の会話の長さ:', conversation.length, '送信予定ID:', targetMessageId);

} else {

console.error('セッションが見つかりません');

}

}).catch(error => {

console.error('初期データ取得エラー:', error);

});

}


import('p5').then(p5Module => {

const p5 = p5Module.default || p5Module;

p5Instance = new p5((sk: any) => {

let srcImg: any;

let needsRedraw = true; // ★ASCIIアートの再描画が必要かどうかのフラグ



// p5インスタンスにフラグを保持

sk.needsRedraw = true;



// --- setup ---

sk.setup = async () => {

sk.createCanvas(sk.windowWidth, sk.windowHeight).parent(container);

// sk.noLoop(); // ★描画ループを有効にするため削除

sk.needsRedraw = true; // ★p5インスタンスにフラグを持たせる



try {

srcImg = await sk.loadImage(data.img);

sk.srcImg = srcImg;


// ASCIIアートの実際のセルサイズを決定

const TARGET_COLS = 72;

const TARGET_ROWS = 48;

const cellX = srcImg.width / TARGET_COLS;

const cellY = srcImg.height / TARGET_ROWS;

editableTextCellSize = Math.max(cellX, cellY);


// ASCIIアートの実際のグリッドに合わせて位置を計算

// renderAscii関数のループと同じ方法でグリッド位置を計算

const actualCols = Math.floor(srcImg.width / editableTextCellSize);

const actualRows = Math.floor(srcImg.height / editableTextCellSize);


// ランダムな位置を決定（実際のグリッドサイズに基づく）

const randomCol = sk.floor(sk.random(Math.max(1, actualCols - editableTextValue.length)));

const randomRow = sk.floor(sk.random(Math.max(1, actualRows - 1)));


// 実際のASCIIアート描画と同じ座標系で位置を決定

editableTextX = randomCol * editableTextCellSize;

editableTextY = randomRow * editableTextCellSize;


needsRedraw = true; // 最初の描画を要求

} catch (e) {

console.error("画像の読み込みに失敗:", e);

}

};



// --- draw (描画ループ) ---

sk.draw = () => {

if (!srcImg) return;



// 再描画が必要な時だけ、重いASCIIアートの再描画を含むrenderAsciiを実行

if (needsRedraw || sk.needsRedraw) {

renderAscii();

needsRedraw = false; // 描画が終わったのでフラグを下ろす

sk.needsRedraw = false; // p5インスタンスのフラグも下ろす

}


// EditableTextコンポーネントを常に描画（座標変換込み）

if (editableTextInstance) {

const baseScale = Math.min(sk.width / srcImg.width, sk.height / srcImg.height);

const scl = baseScale * zoom;

const offX = (sk.width - (srcImg.width * scl)) / 2 + panX;

const offY = (sk.height - (srcImg.height * scl)) / 2 + panY;



sk.push();


// 編集中かどうかで表示位置を変更

if (isEditingText) {

// 編集中は半透明の背景オーバーレイを追加

sk.fill(0, 0, 0, 100); // 黒の半透明オーバーレイ

sk.noStroke();

sk.rect(0, 0, sk.width, sk.height);


// 編集中のテキストサイズを小さく調整

let editingCellSize;

if (sk.width < 768) { // モバイルデバイス

// モバイルでは元のサイズの80%、最小20px、最大40px

editingCellSize = Math.max(20, Math.min(editableTextCellSize * 0.8, 40));

} else { // デスクトップ

// デスクトップでは元のサイズの60%、最大30px

editingCellSize = Math.min(editableTextCellSize * 0.6, 30);

}

const textWidth = editableTextValue.length * editingCellSize;


// スマートフォンでのキーボード表示を考慮して位置を調整

const centerX = sk.width / 2;

// デバイスの種類とビューポートサイズを考慮

let positionY;

if (sk.width < 768) { // モバイルデバイス

// キーボード表示時でも見える位置（画面の上から25%の位置）

positionY = sk.height * 0.25;

} else { // デスクトップ

// 中央よりやや上（画面の上から35%の位置）

positionY = sk.height * 0.35;

}


// 画面中央より上に配置（テキストの開始位置を調整）

const centeredX = centerX - textWidth / 2;

const centeredY = positionY - editingCellSize / 2;


// 描画（画面座標系で配置、小さいサイズで）

editableTextInstance.draw(sk, centeredX, centeredY, editingCellSize);

} else {

// 通常時はASCIIアート内の指定位置に表示

sk.translate(offX, offY);

sk.scale(scl);


// 描画（ASCIIアートと同じグリッド位置に配置）

editableTextInstance.draw(sk, editableTextX, editableTextY, editableTextCellSize);

}


sk.pop();

}

};



// --- renderAscii (背景描画専用) ---

function renderAscii() {

let cell = editableTextCellSize;

const table = [...data.chars];


sk.textFont('monospace', cell);

sk.textAlign(sk.CENTER, sk.CENTER); // テキストを中央揃えに設定

sk.background(0);


const baseScale = Math.min(sk.width / srcImg.width, sk.height / srcImg.height);

const scl = baseScale * zoom;

const offX = (sk.width - (srcImg.width * scl)) / 2 + panX;

const offY = (sk.height - (srcImg.height * scl)) / 2 + panY;



// 座標系を一度だけ設定

sk.push();

sk.translate(offX, offY);

sk.scale(scl);



// 1. 背景のASCIIアートを描画

srcImg.loadPixels();


// EditableTextの領域を計算（グリッド座標で）

const textStartCol = Math.floor(editableTextX / cell);

const textStartRow = Math.floor(editableTextY / cell);


for (let y = 0; y < srcImg.height; y += cell) {

for (let x = 0; x < srcImg.width; x += cell) {

// 現在のグリッド位置を計算

const gridCol = Math.floor(x / cell);

const gridRow = Math.floor(y / cell);


// EditableTextの領域かどうかを判定

let isTextInputArea = false;

if (gridRow === textStartRow && gridCol >= textStartCol && gridCol < textStartCol + editableTextValue.length) {

// その位置に実際に文字があるかをチェック

const charIndex = gridCol - textStartCol;

const char = editableTextValue[charIndex];

// 文字が存在し、かつ空白でない場合のみスキップ

if (char && char.trim() !== '') {

isTextInputArea = true;

}

}

if (isTextInputArea) continue; // EditableTextの文字がある領域はスキップ


const [r, g, b] = srcImg.get(x, y);

const lum = (r + g + b) / 3;

const idx = sk.floor(sk.map(lum, 0, 255, table.length - 1, 0));

const ch = table[idx] ?? table[0];

sk.fill(lum);

sk.text(ch, x + cell/2, y + cell/2);

}

}


sk.pop(); // 座標系をリセット

}



// --- イベントハンドラ ---

sk.windowResized = () => {

sk.resizeCanvas(sk.windowWidth, sk.windowHeight);

needsRedraw = true; // 再描画を要求

};



sk.mouseWheel = (event: any) => {

const zoomFactor = 0.1;

const newZoom = zoom + (event.delta > 0 ? -zoomFactor : zoomFactor);

zoom = Math.max(0.5, Math.min(5, newZoom));

needsRedraw = true; // 再描画を要求

return false;

};



sk.mousePressed = () => {

// ★EditableTextがクリックされたか先に判定（座標変換を考慮）

if (editableTextInstance && srcImg) {

let clicked = false;


if (isEditingText) {

// 編集中は画面座標系でクリック判定

clicked = editableTextInstance.mousePressed(sk);

} else {

// 通常時は画像座標系でクリック判定

// マウス座標を画像座標系に変換

const baseScale = Math.min(sk.width / srcImg.width, sk.height / srcImg.height);

const scl = baseScale * zoom;

const offX = (sk.width - (srcImg.width * scl)) / 2 + panX;

const offY = (sk.height - (srcImg.height * scl)) / 2 + panY;


// スクリーン座標から画像座標系への変換

const transformedX = (sk.mouseX - offX) / scl;

const transformedY = (sk.mouseY - offY) / scl;


// 変換後の座標でマウス判定を実行

const originalMouseX = sk.mouseX;

const originalMouseY = sk.mouseY;

sk.mouseX = transformedX;

sk.mouseY = transformedY;


clicked = editableTextInstance.mousePressed(sk);


// 元の座標に戻す

sk.mouseX = originalMouseX;

sk.mouseY = originalMouseY;

}


if (clicked) {

handleFirstClick(); // 初回クリック時の処理を実行

return false;

}

}

isDragging = true;

lastX = sk.mouseX;

lastY = sk.mouseY;

return false;

};



sk.mouseDragged = () => {

if (isDragging) {

panX += sk.mouseX - lastX;

panY += sk.mouseY - lastY;

lastX = sk.mouseX;

lastY = sk.mouseY;

needsRedraw = true; // 再描画を要求

}

};



sk.mouseReleased = () => {

isDragging = false;

};



sk.touchStarted = (event: TouchEvent) => {

event.preventDefault();

// ★EditableTextがタッチされたか先に判定（座標変換を考慮）

if (editableTextInstance && srcImg && sk.touches.length > 0) {

let touched = false;


if (isEditingText) {

// 編集中は画面座標系でタッチ判定

// タッチ座標を一時的にmouseXYに設定

const originalMouseX = sk.mouseX;

const originalMouseY = sk.mouseY;

sk.mouseX = sk.touches[0].x;

sk.mouseY = sk.touches[0].y;


touched = editableTextInstance.mousePressed(sk);


// 元の座標に戻す

sk.mouseX = originalMouseX;

sk.mouseY = originalMouseY;

} else {

// 通常時は画像座標系でタッチ判定

// マウス座標を画像座標系に変換

const baseScale = Math.min(sk.width / srcImg.width, sk.height / srcImg.height);

const scl = baseScale * zoom;

const offX = (sk.width - (srcImg.width * scl)) / 2 + panX;

const offY = (sk.height - (srcImg.height * scl)) / 2 + panY;


// タッチ座標から画像座標系への変換

const transformedX = (sk.touches[0].x - offX) / scl;

const transformedY = (sk.touches[0].y - offY) / scl;


// 変換後の座標でマウス判定を実行

const originalMouseX = sk.mouseX;

const originalMouseY = sk.mouseY;

sk.mouseX = transformedX;

sk.mouseY = transformedY;


touched = editableTextInstance.mousePressed(sk);


// 元の座標に戻す

sk.mouseX = originalMouseX;

sk.mouseY = originalMouseY;

}


if (touched) {

handleFirstClick(); // 初回クリック時の処理を実行

return false;

}

}

if (sk.touches.length === 1) {

isDragging = true;

lastX = sk.touches[0].x;

lastY = sk.touches[0].y;

}

return false;

};



sk.touchMoved = () => {

if (sk.touches.length === 1 && isDragging) {

panX += sk.touches[0].x - lastX;

panY += sk.touches[0].y - lastY;

lastX = sk.touches[0].x;

lastY = sk.touches[0].y;

needsRedraw = true; // 再描画を要求

}

return false;

};



sk.touchEnded = () => {

isDragging = false;

};

});

});

});



</script>



<div bind:this={container} aria-label={data.alt}></div>



<EditableText

bind:this={editableTextInstance}

bind:value={editableTextValue}

bind:isEditing={isEditingText}

cellSize={editableTextCellSize}

fontSize={editableTextCellSize}

backgroundColor="black"

textColor={dynamicTextColor}

hoverBackgroundColor="rgba(50, 50, 50, 0.8)"

editingBackgroundColor="rgba(100, 100, 100, 0.9)"

showAddButton={dynamicShowAddButton}

isShiritoriMode={true}

initialValue={initialWord}

onSubmit={handleShiritoriSubmit}

sessionId={data.sessionId}

/>



<!-- ズームコントロール -->

<div class="zoom-controls">

<button on:click={zoomIn} aria-label="ズームイン">+</button>

<button on:click={resetZoom} aria-label="リセット">⌂</button>

<button on:click={zoomOut} aria-label="ズームアウト">-</button>

</div>



<style>

:global(html), :global(body) {

margin: 0;

padding: 0;

width: 100%;

height: 100vh;

background: #000;

overflow: hidden;

/* モバイルでのズームや位置ずれを防止 */

touch-action: pan-x pan-y;

-webkit-user-select: none;

-moz-user-select: none;

-ms-user-select: none;

user-select: none;

}

:global(canvas) {

display: block;

/* モバイルでのタッチ動作を改善 */

touch-action: none;

}


.zoom-controls {

position: fixed;

bottom: 20px;

right: 20px;

display: flex;

flex-direction: column;

gap: 8px;

z-index: 1000;

}


.zoom-controls button {

width: 50px;

height: 50px;

background: rgba(255, 255, 255, 0.2);

border: 1px solid rgba(255, 255, 255, 0.3);

border-radius: 50%;

color: white;

font-size: 20px;

font-weight: bold;

cursor: pointer;

display: flex;

align-items: center;

justify-content: center;

backdrop-filter: blur(10px);

transition: all 0.2s ease;

}


.zoom-controls button:hover {

background: rgba(255, 255, 255, 0.3);

transform: scale(1.1);

}


.zoom-controls button:active {

transform: scale(0.95);

}


@media (max-width: 768px) {

.zoom-controls {

bottom: 30px;

right: 20px;

}


.zoom-controls button {

width: 45px;

height: 45px;

font-size: 18px;

}

}

</style>