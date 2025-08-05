<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { doc, getDoc, onSnapshot } from 'firebase/firestore';
  import { db } from '$lib/firebase';
  import LoadingTransition from '$lib/component/LoadingTransition.svelte';

  let statusMessage = '';
  let isLoading = true;
  let unsubscribeFirestore: (() => void) | null = null;

  onMount(async () => {
    // 1. URLからセッションIDとfromパラメータを取得
    const sessionId = $page.url.searchParams.get('s');
    const fromParam = $page.url.searchParams.get('from');

    if (!sessionId) {
      statusMessage = 'Error: Session ID not found.';
      return;
    }

    try {
      // 2. セッションIDを元にFirestoreからデータを取得
      const sessionRef = doc(db, 'sessions', sessionId);
      const docSnap = await getDoc(sessionRef);

      if (docSnap.exists()) {
        const sessionData = docSnap.data();
        let keyword;

        // 3. fromパラメータに応じてキーワードを決定
        if (fromParam === 'ai') {
          // from=aiの場合はFirestore監視を開始してAIメッセージを待つ
          console.log('from=aiパラメータ検出、AIメッセージを監視開始');
          
          // 現在の会話を取得
          const conversation = sessionData.conversation || [];
          
          // Firestoreのリアルタイム監視を開始
          unsubscribeFirestore = onSnapshot(sessionRef, (doc) => {
            if (doc.exists()) {
              const firestoreData = doc.data();
              const updatedConversation = firestoreData.conversation || [];
              
              // 新しいAIメッセージが追加されたかチェック
              const aiMessages = updatedConversation.filter((msg: any) => msg.sender === 'ai');
              const initialAiCount = conversation.filter((msg: any) => msg.sender === 'ai').length;
              
              if (aiMessages.length > initialAiCount) {
                // 新しいAIメッセージを検出
                const latestAiMessage = aiMessages[aiMessages.length - 1];
                const keyword = latestAiMessage.text;
                console.log('新しいAIメッセージを検出:', keyword);
                
                // 2秒後に遷移
                setTimeout(async () => {
                  if (unsubscribeFirestore) {
                    unsubscribeFirestore();
                    unsubscribeFirestore = null;
                  }
                  isLoading = false;
                  await goto(`/ascii/${encodeURIComponent(keyword)}?s=${encodeURIComponent(sessionId)}`);
                }, 2000);
              }
            }
          }, (error) => {
            console.error('Firestore監視エラー:', error);
            statusMessage = 'Error: Failed to monitor session updates.';
            isLoading = false;
          });
          
          // タイムアウト処理（30秒でタイムアウト）
          setTimeout(() => {
            if (unsubscribeFirestore) {
              unsubscribeFirestore();
              unsubscribeFirestore = null;
              statusMessage = 'Timeout: AIメッセージの待機がタイムアウトしました。';
              isLoading = false;
            }
          }, 30000);
          
        } else {
          // 通常通りセッションのキーワードを使用
          const keyword = sessionData.keyword;
          
          // 少し待ってから遷移（ローディングアニメーションを見せるため）
          setTimeout(async () => {
            isLoading = false;
            // /ascii/[keyword] ページへジャンプ（セッションIDもパラメータとして渡す）
            await goto(`/ascii/${encodeURIComponent(keyword)}?s=${encodeURIComponent(sessionId)}`);
          }, 1500); // 1.5秒後に遷移
        }

      } else {
        isLoading = false;
        statusMessage = 'Error: Invalid session.';
      }
    } catch (error) {
      isLoading = false;
      statusMessage = 'Error: Failed to retrieve session data.';
      console.error(error);
    }
  });

  // コンポーネント破棄時にFirestore監視を停止
  onDestroy(() => {
    if (unsubscribeFirestore) {
      unsubscribeFirestore();
      unsubscribeFirestore = null;
    }
  });
</script>

<main>
  {#if statusMessage}
    <h1>Error</h1>
    <p>{statusMessage}</p>
  {/if}
</main>

<!-- ローディングアニメーション（ミニバージョン） -->
<LoadingTransition
  isActive={isLoading}
  isMini={true}
  duration={3000}
  cellSize={14}
  miniSize={120}
  loadingText="Loading..."
/>

<style>
  main {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    font-family: sans-serif;
    background-color: transparent;
    z-index: 10000;
  }
  
  :global(body) {
    background-color: black;
    margin: 0;
    padding: 0;
  }
  
  h1 {
    color: white;
    margin-bottom: 20px;
  }
  p {
    color: lightgray;
    font-size: 1.2em;
  }
</style>