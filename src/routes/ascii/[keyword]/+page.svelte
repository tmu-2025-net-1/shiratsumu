<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	import EditableText from '$lib/component/EditableText.svelte';
	import LoadingTransition from '$lib/component/LoadingTransition.svelte';

	import { doc, updateDoc, runTransaction, getDoc, onSnapshot } from 'firebase/firestore';
	import { goto } from '$app/navigation';

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

	// タッチスケール関連の変数
	let isScaling = false;
	let lastTouchDistance = 0;

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

	let dynamicTextColor = "rgba(137, 137, 137, 0.8)";

	// let dynamicTextColor = 'rgba(255, 0, 0, 0.8)'; //テスト用に赤く(これはpush時に削除)

	let dynamicShowAddButton = false;

	// 編集状態を管理する変数

	let isEditingText = false;

	// ヘルプテキスト関連の変数
	let helpText = '';
	let showHelpText = false;

	// メッセージ表示関連の変数（成功/失敗メッセージ用）
	let messageText = '';
	let showMessage = false;
	let messageTimeout: ReturnType<typeof setTimeout> | null = null;
	let navigationTimeout: ReturnType<typeof setTimeout> | null = null; // ページ遷移用タイマー

	// ヘルプテキストの更新
	$: {
		if (isEditingText && editableTextInstance) {
			const status = editableTextInstance.getEditingStatus();
			if (status) {
				helpText = status.message;
				showHelpText = true;
			} else {
				showHelpText = false;
			}
		} else {
			showHelpText = false;
		}
	}

	// メッセージを表示する関数
	function showMessageOverlay(message: string, duration: number = 5000) {
		messageText = message;
		showMessage = true;
		
		// 既存のタイマーをクリア
		if (messageTimeout) {
			clearTimeout(messageTimeout);
		}
		
		// 指定時間後にメッセージを非表示
		messageTimeout = setTimeout(() => {
			showMessage = false;
			messageText = '';
			// メッセージが消えるときも再描画
			if (p5Instance) p5Instance.needsRedraw = true;
		}, duration);
		
		// p5.jsの再描画をトリガー
		if (p5Instance) p5Instance.needsRedraw = true;
	}

	// しりとり機能用の変数

	let initialWord = data.q; // 初期の単語を保存

	// ページロード時の会話の長さを記録（このページから送信するメッセージのID決定用）

	let targetMessageId: number | null = null;

	// Firestoreの監視用変数
	let unsubscribeFirestore: (() => void) | null = null;
	let lastConversationLength = 0; // 初期の会話の長さを記録

	// ローディングトランジション用の変数
	let isLoading = true;
	let loadingCellSize = 15; // 初期値（動的に更新される）

	// ローディング完了時の処理
	function handleLoadingComplete() {
		isLoading = false;
		console.log('ローディングトランジション完了');
	}

	// しりとり送信処理

	async function handleShiritoriSubmit(newValue: string) {
		console.log('しりとり送信:', newValue);

		// targetMessageIdが設定されていない場合は送信しない

		if (targetMessageId === null) {
			showMessageOverlay('Initialization not yet complete. Please wait and try again.', 6000);

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

						return { success: false, message: 'Session not found' };
					}

					const currentData = sessionDoc.data();

					const conversation = currentData.conversation || [];

					// 指定されたIDのユーザーメッセージが既に存在するかチェック

					const hasTargetResponse = conversation.some(
						(msg: { id: number; sender: string; text: string }) =>
							msg.id === targetMessageId && msg.sender === 'user'
					);

					if (hasTargetResponse) {
						// 既に他のユーザーが回答済み

						return { success: false, message: 'Sorry! Someone else answered first.' };
					}

					// 新しいメッセージを追加（ページロード時に決定したIDで送信）

					const newMessage = {
						id: targetMessageId,

						sender: 'user',

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

					showMessageOverlay('Submission complete! Please wait...', 4000); // 送信完了メッセージを4秒表示
				} else {
					console.log('送信失敗:', result.message);

					showMessageOverlay(result.message, 6000); // "Sorry! Someone else answered first."を6秒表示

					return; // 失敗時はローカル状態を更新しない
				}
			} catch (error) {
				console.error('Firestore送信エラー:', error);

				showMessageOverlay('An error occurred during submission.', 6000);

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

			dynamicTextColor = 'white';

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

		// ヘルプテキストの更新も値の変化に応じて行う
		if (isEditingText && editableTextInstance) {
			setTimeout(() => {
				const status = editableTextInstance.getEditingStatus();
				if (status) {
					helpText = status.message;
					showHelpText = true;
				} else {
					showHelpText = false;
				}
			}, 0);
		}
	}

	// ★3. コンポーネントの位置を保持

	let editableTextX = 0;

	let editableTextY = 0;

	let editableTextCellSize = 0;

	onMount(() => {
        // ローディングトランジションを開始
        isLoading = true;
        
        // ローディング用のセルサイズを画面幅から計算
        const TARGET_COLS = 72;
        loadingCellSize = window.innerWidth / TARGET_COLS;

        // セッションIDの取得処理とFirestoreの監視開始
        if (data.sessionId) {
            const sessionRef = doc(db, 'sessions', data.sessionId);
            
            // 初期データの取得
            getDoc(sessionRef)
                .then((docSnap) => {
                    if (docSnap.exists()) {
                        const currentData = docSnap.data();
                        const conversation = currentData.conversation || [];
                        targetMessageId = conversation.length + 1;
                        lastConversationLength = conversation.length; // 初期の長さを記録
                        
                        // Firestoreのリアルタイム監視を開始
                        unsubscribeFirestore = onSnapshot(sessionRef, (doc) => {
                            if (doc.exists()) {
                                const firestoreData = doc.data();
                                const conversation = firestoreData.conversation || [];
                                
                                // 新しいメッセージが追加された場合
                                if (conversation.length > lastConversationLength) {
                                    // 最新のメッセージを取得
                                    const latestMessage = conversation[conversation.length - 1];
                                    
                                    // ユーザーからの新しいメッセージかチェック（自分以外のユーザー）
                                    if (latestMessage && latestMessage.sender === 'user') {
                                        console.log('他のユーザーからの新しいメッセージを検出:', latestMessage.text);

                                        // メッセージを表示してから遷移
                                        showMessageOverlay('Another user answered! Moving to next turn...', 3000);
                                        
                                        // 既存のナビゲーションタイマーをクリア
                                        if (navigationTimeout) {
                                            clearTimeout(navigationTimeout);
                                        }
                                        
                                        // 3秒後にjoinページに移動（from=aiパラメータ付きで移動）
                                        navigationTimeout = setTimeout(() => {
                                            goto(`/join?s=${data.sessionId}&from=ai`);
                                        }, 3000);
                                    }
                                    
                                    // 会話の長さを更新
                                    lastConversationLength = conversation.length;
                                }
                            }
                        }, (error) => {
                            console.error('Firestore監視エラー:', error);
                        });
                    } else {
                        console.error('セッションが見つかりません');
                    }
                })
                .catch((error) => {
                    console.error('初期データ取得エラー:', error);
                });
        }

        // --- イベント処理ロジック (文字クリック判定を追加) ---

        let isPointerDown = false;
        let lastPointerX = 0;
        let lastPointerY = 0;
        let lastTouchDist = 0;

        // ▼▼▼▼▼ 【新規追加】クリック/タッチが文字の上か判定する関数 ▼▼▼▼▼
        const checkIfClickOnText = (clientX: number, clientY: number): boolean => {
            if (!p5Instance || !p5Instance.srcImg || !editableTextInstance) {
                return false;
            }

            // キャンバスの相対座標を取得（より安全な方法）
            const canvas = p5Instance.canvas;
            if (!canvas) return false;
            
            // フレームを待ってからrectを取得（レイアウトが確定するまで待機）
            const rect = canvas.getBoundingClientRect();
            
            // rectが有効かチェック
            if (rect.width === 0 || rect.height === 0) {
                console.warn('Canvas rect is not ready:', rect);
                return false;
            }
            
            const canvasX = clientX - rect.left;
            const canvasY = clientY - rect.top;

            // デバッグ情報を追加
            console.log('Click debug:', {
                clientX, clientY,
                rectLeft: rect.left, rectTop: rect.top,
                canvasX, canvasY,
                canvasWidth: rect.width, canvasHeight: rect.height,
                isEditingText
            });

            // 編集中は、画面中央の座標系で判定
            if (isEditingText) {
                // p5.jsのmouseX/Yを一時的に設定して判定させる
                const originalMouseX = p5Instance.mouseX;
                const originalMouseY = p5Instance.mouseY;
                p5Instance.mouseX = canvasX;
                p5Instance.mouseY = canvasY;

                const clicked = editableTextInstance.mousePressed(p5Instance);

                p5Instance.mouseX = originalMouseX;
                p5Instance.mouseY = originalMouseY;
                return clicked;
            }

            // 通常時は座標変換が必要
            const baseScale = Math.min(
                p5Instance.width / p5Instance.srcImg.width,
                p5Instance.height / p5Instance.srcImg.height
            );
            const scl = baseScale * zoom;
            const offX = (p5Instance.width - p5Instance.srcImg.width * scl) / 2 + panX;
            const offY = (p5Instance.height - p5Instance.srcImg.height * scl) / 2 + panY;

            // スクリーン座標からp5キャンバス内の座標に変換
            const transformedX = (canvasX - offX) / scl;
            const transformedY = (canvasY - offY) / scl;

            // デバッグ情報を追加
            console.log('Transform debug:', {
                baseScale, scl, zoom,
                offX, offY, panX, panY,
                transformedX, transformedY
            });

            // p5.jsのmouseX/Yを一時的に設定して判定させる
            const originalMouseX = p5Instance.mouseX;
            const originalMouseY = p5Instance.mouseY;
            p5Instance.mouseX = transformedX;
            p5Instance.mouseY = transformedY;

            const clicked = editableTextInstance.mousePressed(p5Instance);

            // 元に戻す
            p5Instance.mouseX = originalMouseX;
            p5Instance.mouseY = originalMouseY;

            return clicked;
        };
        // ▲▲▲▲▲ 【新規追加】ここまで ▲▲▲▲▲

        // ▼▼▼ マウス操作のハンドラ (判定処理を追加) ▼▼▼
        const handleMouseDown = (e: MouseEvent) => {
            e.preventDefault();
            
            // レイアウトの確定を待つためのリトライロジック
            const tryClickDetection = (retryCount = 0) => {
                if (retryCount > 3) {
                    // 3回試行して失敗した場合は通常のパン処理を実行
                    isPointerDown = true;
                    lastPointerX = e.clientX;
                    lastPointerY = e.clientY;
                    return;
                }
                
                // ★★★ 文字クリック判定 ★★★
                if (checkIfClickOnText(e.clientX, e.clientY)) {
                    handleFirstClick();
                    return; // 文字の上ならパン処理をしない
                }
                
                // レイアウトがまだ準備できていない可能性があるため再試行
                if (p5Instance?.canvas) {
                    const rect = p5Instance.canvas.getBoundingClientRect();
                    if (rect.width === 0 || rect.height === 0) {
                        // キャンバスがまだ準備できていない場合は少し待って再試行
                        requestAnimationFrame(() => tryClickDetection(retryCount + 1));
                        return;
                    }
                }
                
                // 通常のパン処理
                isPointerDown = true;
                lastPointerX = e.clientX;
                lastPointerY = e.clientY;
            };
            
            tryClickDetection();
        };

        const handleMouseMove = (e: MouseEvent) => {
            if (!isPointerDown) return;
            const dx = e.clientX - lastPointerX;
            const dy = e.clientY - lastPointerY;
            panX += dx;
            panY += dy;
            lastPointerX = e.clientX;
            lastPointerY = e.clientY;
            if (p5Instance) p5Instance.needsRedraw = true;
        };

        const handleMouseUp = () => {
            isPointerDown = false;
        };

        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            const zoomFactor = 0.1;
            const newZoom = zoom + (e.deltaY > 0 ? -zoomFactor : zoomFactor);
            zoom = Math.max(0.5, Math.min(5, newZoom));
            if (p5Instance) p5Instance.needsRedraw = true;
        };

        // ▼▼▼ タッチ操作のハンドラ (判定処理を追加) ▼▼▼
        const handleTouchStart = (e: TouchEvent) => {
            e.preventDefault();
            if (e.touches.length === 1) {
                // ★★★ 文字タッチ判定 ★★★
                if (checkIfClickOnText(e.touches[0].clientX, e.touches[0].clientY)) {
                    handleFirstClick();
                    return; // 文字の上ならパン処理をしない
                }
                isPointerDown = true;
                lastPointerX = e.touches[0].clientX;
                lastPointerY = e.touches[0].clientY;
            } else if (e.touches.length >= 2) {
                isPointerDown = false;
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                lastTouchDist = Math.sqrt(dx * dx + dy * dy);
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            e.preventDefault();
            if (e.touches.length === 1 && isPointerDown) {
                const dx = e.touches[0].clientX - lastPointerX;
                const dy = e.touches[0].clientY - lastPointerY;
                panX += dx;
                panY += dy;
                lastPointerX = e.touches[0].clientX;
                lastPointerY = e.touches[0].clientY;
                if (p5Instance) p5Instance.needsRedraw = true;
            } else if (e.touches.length >= 2) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const currentDist = Math.sqrt(dx * dx + dy * dy);
                if (lastTouchDist > 0) {
                    const delta = currentDist - lastTouchDist;
                    const newZoom = zoom + delta * 0.01;
                    zoom = Math.max(0.5, Math.min(5, newZoom));
                    if (p5Instance) p5Instance.needsRedraw = true;
                }
                lastTouchDist = currentDist;
            }
        };

        const handleTouchEnd = (e: TouchEvent) => {
            isPointerDown = false;
            lastTouchDist = 0;
        };

        // ▼▼▼ イベントリスナーの登録（変更なし） ▼▼▼
        container.addEventListener('mousedown', handleMouseDown);
        container.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        container.addEventListener('wheel', handleWheel, { passive: false });
        container.addEventListener('touchstart', handleTouchStart, { passive: false });
        container.addEventListener('touchmove', handleTouchMove, { passive: false });
        container.addEventListener('touchend', handleTouchEnd);
        container.addEventListener('touchcancel', handleTouchEnd);

        // ▼▼▼ p5.jsのインスタンス化（変更なし） ▼▼▼
        import('p5').then((p5Module) => {
            // ... (この中のp5.jsのコードは変更ありません)
            const p5 = p5Module.default || p5Module;
            p5Instance = new p5((sk: any) => {
                let srcImg: any;
                let needsRedraw = true;
                sk.needsRedraw = true;

                sk.setup = async () => {
                    sk.createCanvas(sk.windowWidth, sk.windowHeight).parent(container);
                    sk.needsRedraw = true;
                    
                    // キャンバスの準備が完了するまで少し待つ
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    try {
                        srcImg = await sk.loadImage(data.img);
                        sk.srcImg = srcImg;
                        const TARGET_COLS = 72;
                        const TARGET_ROWS = 48;
                        const cellX = srcImg.width / TARGET_COLS;
                        const cellY = srcImg.height / TARGET_ROWS;
                        editableTextCellSize = Math.max(cellX, cellY);
                        const actualCols = Math.floor(srcImg.width / editableTextCellSize);
                        const actualRows = Math.floor(srcImg.height / editableTextCellSize);
                        const randomCol = sk.floor(sk.random(Math.max(1, actualCols - editableTextValue.length)));
                        const randomRow = sk.floor(sk.random(Math.max(1, actualRows - 1)));
                        editableTextX = randomCol * editableTextCellSize;
                        editableTextY = randomRow * editableTextCellSize;
                        needsRedraw = true;
                        
                        // 初期化完了をログに出力
                        console.log('p5.js setup completed, canvas ready for interactions');
                    } catch (e) {
                        console.error('画像の読み込みに失敗:', e);
                    }
                    sk.windowResized = () => {
                        sk.resizeCanvas(sk.windowWidth, sk.windowHeight);
                        needsRedraw = true;
                    };
                };
                sk.draw = () => {
                    if (!srcImg) return;
                    if (needsRedraw || sk.needsRedraw || showMessage) {
                        renderAscii();
                        needsRedraw = false;
                        sk.needsRedraw = false;
                    }
                    if (editableTextInstance) {
                        const baseScale = Math.min(sk.width / srcImg.width, sk.height / srcImg.height);
                        const scl = baseScale * zoom;
                        const offX = (sk.width - srcImg.width * scl) / 2 + panX;
                        const offY = (sk.height - srcImg.height * scl) / 2 + panY;
                        sk.push();
                        if (isEditingText) {
                            sk.fill(0, 0, 0, 100);
                            sk.noStroke();
                            sk.rect(0, 0, sk.width, sk.height);
                            let editingCellSize;
                            if (sk.width < 768) {
                                editingCellSize = Math.max(20, Math.min(editableTextCellSize * 0.8, 40));
                            } else {
                                editingCellSize = Math.min(editableTextCellSize * 0.6, 30);
                            }
                            const textWidth = editableTextValue.length * editingCellSize;
                            const centerX = sk.width / 2;
                            let positionY;
                            if (sk.width < 768) {
                                positionY = sk.height * 0.25;
                            } else {
                                positionY = sk.height * 0.35;
                            }
                            const centeredX = centerX - textWidth / 2;
                            const centeredY = positionY - editingCellSize / 2;
                            editableTextInstance.draw(sk, centeredX, centeredY, editingCellSize);
                            
                            // ヘルプテキストをp5.jsキャンバス内に描画
                            if (editableTextInstance && showHelpText && helpText) {
                                sk.push();
                                sk.fill(0, 0, 0, 200); // 半透明の黒背景
                                sk.stroke(255, 255, 255, 100);
                                sk.strokeWeight(2);
                                
                                // ヘルプテキストのサイズを計算
                                const helpFontSize = sk.width < 768 ? 14 : 18;
                                sk.textFont('monospace', helpFontSize);
                                sk.textAlign(sk.CENTER, sk.CENTER);
                                
                                // スマホ用の適切な折り返し処理
                                const maxWidth = sk.width * 0.85; // 画面幅の85%を使用
                                const padding = 20;
                                const availableWidth = maxWidth - padding * 2;
                                
                                // 単語単位で折り返すためのヘルパー関数
                                const wrapText = (text: string, maxWidth: number) => {
                                    const words = text.split(' ');
                                    const lines: string[] = [];
                                    let currentLine = '';
                                    
                                    for (const word of words) {
                                        const testLine = currentLine + (currentLine ? ' ' : '') + word;
                                        const testWidth = sk.textWidth(testLine);
                                        
                                        if (testWidth <= maxWidth) {
                                            currentLine = testLine;
                                        } else {
                                            if (currentLine) {
                                                lines.push(currentLine);
                                                currentLine = word;
                                            } else {
                                                // 単語が長すぎる場合は強制改行
                                                lines.push(word);
                                            }
                                        }
                                    }
                                    
                                    if (currentLine) {
                                        lines.push(currentLine);
                                    }
                                    
                                    return lines;
                                };
                                
                                const lines = wrapText(helpText, availableWidth);
                                
                                // 背景の矩形サイズを計算
                                const lineHeight = helpFontSize + 8; // 行の高さ
                                const rectHeight = lines.length * lineHeight + padding * 2;
                                const rectWidth = maxWidth;
                                const rectX = sk.width / 2 - rectWidth / 2;
                                
                                // スマホの場合はもっと上部に表示（キーボード対応）
                                let rectY;
                                if (sk.width < 768) {
                                    rectY = sk.height * 0.12 - rectHeight / 2; // 上部12%の位置
                                } else {
                                    rectY = sk.height * 0.6 - rectHeight / 2; // PC版は60%
                                }
                                
                                // 背景矩形を描画
                                sk.rect(rectX, rectY, rectWidth, rectHeight, 10);
                                
                                // テキストを行ごとに描画
                                sk.fill(255);
                                sk.noStroke();
                                const startY = rectY + padding + helpFontSize / 2;
                                lines.forEach((line, index) => {
                                    const lineY = startY + index * lineHeight;
                                    sk.text(line, sk.width / 2, lineY);
                                });
                                sk.pop();
                            }
                        } else {
                            sk.translate(offX, offY);
                            sk.scale(scl);
                            editableTextInstance.draw(sk, editableTextX, editableTextY, editableTextCellSize);
                        }
                        
                        // メッセージ表示（ヘルプテキストと同じスタイルで、編集中でなくても表示）
                        if (showMessage && messageText) {
                            sk.push();
                            // 座標変換をリセットして画面座標で描画
                            sk.resetMatrix();
                            
                            sk.fill(0, 0, 0, 200); // 半透明の黒背景
                            sk.stroke(255, 255, 255, 100);
                            sk.strokeWeight(2);
                            
                            // メッセージのサイズを計算
                            const messageFontSize = sk.width < 768 ? 16 : 20;
                            sk.textFont('monospace', messageFontSize);
                            sk.textAlign(sk.LEFT, sk.CENTER); // 左揃えに変更
                            
                            // スマホ用の適切な折り返し処理
                            const maxWidth = sk.width * 0.85; // 画面幅の85%を使用
                            const padding = 20;
                            const availableWidth = maxWidth - padding * 2;
                            
                            // 単語単位で折り返すためのヘルパー関数（ヘルプテキストと同じ）
                            const wrapText = (text: string, maxWidth: number) => {
                                const words = text.split(' ');
                                const lines: string[] = [];
                                let currentLine = '';
                                
                                for (const word of words) {
                                    const testLine = currentLine + (currentLine ? ' ' : '') + word;
                                    const testWidth = sk.textWidth(testLine);
                                    
                                    if (testWidth <= maxWidth) {
                                        currentLine = testLine;
                                    } else {
                                        if (currentLine) {
                                            lines.push(currentLine);
                                            currentLine = word;
                                        } else {
                                            // 単語が長すぎる場合は強制改行
                                            lines.push(word);
                                        }
                                    }
                                }
                                
                                if (currentLine) {
                                    lines.push(currentLine);
                                }
                                
                                return lines;
                            };
                            
                            const lines = wrapText(messageText, availableWidth);
                            
                            // 背景の矩形サイズを計算
                            const lineHeight = messageFontSize + 8; // 行の高さ
                            const rectHeight = lines.length * lineHeight + padding * 2;
                            const rectWidth = maxWidth;
                            const rectX = sk.width / 2 - rectWidth / 2;
                            
                            // メッセージは画面の正確な中央に表示
                            const rectY = sk.height / 2 - rectHeight / 2;
                            
                            // 背景矩形を描画
                            sk.rect(rectX, rectY, rectWidth, rectHeight, 10);
                            
                            // テキストを行ごとに描画（左揃え）
                            sk.fill(255);
                            sk.noStroke();
                            const startY = rectY + padding + messageFontSize / 2;
                            const textX = rectX + padding; // 左端からpadding分だけ右に
                            lines.forEach((line, index) => {
                                const lineY = startY + index * lineHeight;
                                sk.text(line, textX, lineY); // 左揃えで描画
                            });
                            sk.pop();
                        }
                        
                        sk.pop();
                    }
                };
                function renderAscii() {
                    let cell = editableTextCellSize;
                    const table = [...data.chars];
                    sk.textFont('monospace', cell);
                    sk.textAlign(sk.CENTER, sk.CENTER);
                    sk.background(0);
                    const baseScale = Math.min(sk.width / srcImg.width, sk.height / srcImg.height);
                    const scl = baseScale * zoom;
                    const offX = (sk.width - srcImg.width * scl) / 2 + panX;
                    const offY = (sk.height - srcImg.height * scl) / 2 + panY;
                    sk.push();
                    sk.translate(offX, offY);
                    sk.scale(scl);
                    srcImg.loadPixels();
                    const textStartCol = Math.floor(editableTextX / cell);
                    const textStartRow = Math.floor(editableTextY / cell);
                    for (let y = 0; y < srcImg.height; y += cell) {
                        for (let x = 0; x < srcImg.width; x += cell) {
                            const gridCol = Math.floor(x / cell);
                            const gridRow = Math.floor(y / cell);
                            let isTextInputArea = false;
                            if (
                                gridRow === textStartRow &&
                                gridCol >= textStartCol &&
                                gridCol < textStartCol + editableTextValue.length
                            ) {
                                const charIndex = gridCol - textStartCol;
                                const char = editableTextValue[charIndex];
                                if (char && char.trim() !== '') {
                                    isTextInputArea = true;
                                }
                            }
                            if (isTextInputArea) continue;
                            const [r, g, b] = srcImg.get(x, y);
                            const lum = (r + g + b) / 3;
                            const idx = sk.floor(sk.map(lum, 0, 255, table.length - 1, 0));
                            const ch = table[idx] ?? table[0];
                            sk.fill(lum);
                            sk.text(ch, x + cell / 2, y + cell / 2);
                        }
                    }
                    sk.pop();
                }
            });
        });

        // ▼▼▼ クリーンアップ処理（Firestore監視の停止を追加） ▼▼▼
        return () => {
            container.removeEventListener('mousedown', handleMouseDown);
            container.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            container.removeEventListener('wheel', handleWheel);
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchmove', handleTouchMove);
            container.removeEventListener('touchend', handleTouchEnd);
            container.removeEventListener('touchcancel', handleTouchEnd);
            
            // Firestoreの監視を停止
            if (unsubscribeFirestore) {
                unsubscribeFirestore();
                unsubscribeFirestore = null;
            }
        };
    });

	// コンポーネント破棄時にFirestore監視を停止
	onDestroy(() => {
		if (unsubscribeFirestore) {
			unsubscribeFirestore();
			unsubscribeFirestore = null;
		}
		
		// メッセージタイマーもクリア
		if (messageTimeout) {
			clearTimeout(messageTimeout);
			messageTimeout = null;
		}
		
		// ナビゲーションタイマーもクリア
		if (navigationTimeout) {
			clearTimeout(navigationTimeout);
			navigationTimeout = null;
		}
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

<!-- ローディングトランジション -->
<LoadingTransition
	cellSize={loadingCellSize}
	isActive={isLoading}
	duration={3000}
	loadingText={data.q}
	on:complete={handleLoadingComplete}
/>

<!-- ズームコントロール -->

<!-- <div class="zoom-controls">
	<button on:click={zoomIn} aria-label="ズームイン">+</button>

	<button on:click={resetZoom} aria-label="リセット">⌂</button>

	<button on:click={zoomOut} aria-label="ズームアウト">-</button>
</div> -->

<style>
	:global(html),
	:global(body) {
		margin: 0;

		padding: 0;

		width: 100%;

		height: 100vh;

		background: #000;

		overflow: hidden;

		/* モバイルでのズームや位置ずれを防止 */

		touch-action: none;

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
