<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { doc, getDoc } from 'firebase/firestore';
  import { db } from '$lib/firebase';

  // Firestoreから取得した会話の型を定義
  type Message = {
    sender: 'user' | 'ai' | 'admin';
    text: string;
  };

  let conversation: Message[] = [];
  let isLoading = true;
  let errorMessage = '';
  let sessionId = '';

  onMount(async () => {
    // URLのクエリパラメータからセッションID (?s=...) を取得
    sessionId = $page.url.searchParams.get('s') || '';

    if (!sessionId) {
      errorMessage = 'セッションIDが見つかりません。URLを確認してください。';
      isLoading = false;
      return;
    }

    try {
      // セッションIDを使ってFirestoreのドキュメントを取得
      const sessionRef = doc(db, 'sessions', sessionId);
      const docSnap = await getDoc(sessionRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        // conversation配列を取得し、もしなければ空の配列をセット
        conversation = data.conversation || [];
      } else {
        errorMessage = `セッション「${sessionId}」の記録が見つかりませんでした。`;
      }
    } catch (error) {
      console.error("Firestoreからのデータ取得エラー:", error);
      errorMessage = '結果の読み込み中にエラーが発生しました。';
    } finally {
      isLoading = false;
    }
  });

  // 単語の最後の文字を取得するヘルパー関数
  function getLastChar(text: string): string {
    return text.slice(-1);
  }

  // 単語の最初の文字を取得するヘルパー関数
  function getFirstChar(text: string): string {
    return text.charAt(0);
  }
</script>

<div class="container">
  <header>
    <h1>RESULT</h1>
    {#if !isLoading && conversation.length > 0}
      <p class="summary">
        The rally continued for <span class="count">{conversation.length}</span> turns!
      </p>
    {/if}
    <!-- 横棒 -->
    <hr class="my-4 border-t border-gray-300" />
  </header>

  <main>
    {#if isLoading}
      <p class="status">結果を読み込んでいます...</p>
    {:else if errorMessage}
      <p class="status error">{errorMessage}</p>
    {:else if conversation.length === 0}
      <p class="status">このセッションには、まだ会話の記録がありません。</p>
    {:else}
      <div class="timeline">
        <!-- adminメッセージを最初に表示 -->
        {#each conversation as message, i}
          {#if message.sender === 'admin'}
            <div class="admin-message">
              <span class="admin-text">{message.text}</span>
            </div>
          {/if}
        {/each}

        <!-- ユーザーとAIの会話を表示 -->
        {#each conversation as message, i}
          <!-- adminのメッセージは上で表示済みなのでスキップ -->
          {#if message.sender !== 'admin'}
            <!-- 矢印の接続部分 (2番目以降のメッセージで表示) -->
            {#if i > 0 && conversation[i-1]}
              {@const prevMessage = conversation[i-1]}
              {#if prevMessage.sender !== 'admin'}
                <div class="connector">
                  <span class="char last">{getLastChar(prevMessage.text)}</span>
                  <span class="arrow">→</span>
                  <span class="char first">{getFirstChar(message.text)}</span>
                </div>
              {/if}
            {/if}

            <!-- メッセージ本体 -->
            <div class="message" class:user={message.sender === 'user'} class:ai={message.sender === 'ai'}>
              <span class="sender">{message.sender === 'user' ? 'us' : 'AI'}</span>
              <span class="text">{message.text}</span>
            </div>
          {/if}
        {/each}
      </div>
    {/if}
  </main>

  <footer>
    <a href="/" class="home-button">play again</a>
  </footer>
</div>

<style>
  .container {
    max-width: 600px;
    margin: 0 auto;
    padding: 2rem 1.5rem;
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    box-sizing: border-box;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    background: #000000;
    color: #ffffff;
    position: relative;
    width: 100%;
  }

  .container::before {
    content: '';
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: #000000;
    z-index: -1;
  }

  header {
    text-align: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
    padding-bottom: 1.5rem;
    margin-bottom: 2rem;
    backdrop-filter: blur(10px);
    background: rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    padding: 2rem;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  h1 {
    font-size: 2.5rem;
    font-weight: 700;
    color: #ffffff;
    margin: 0 0 0.5rem 0;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    text-shadow: none;
  }

  .summary {
    font-size: 1.1rem;
    color: #ffffff;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  }

  .count {
    font-weight: bold;
    font-size: 1.5rem;
    color: #ff6b35;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  }

  main {
    flex-grow: 1;
    padding-bottom: 6rem; /* footerのスペースを確保 */
  }

  .status {
    text-align: center;
    color: #ffffff;
    font-size: 1.1rem;
    padding: 3rem 0;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  }
  .status.error {
    color: #ff8a8a;
  }

  .timeline {
    display: flex;
    flex-direction: column;
  }

  .admin-message {
    text-align: center;
    margin-bottom: 1rem;
    padding: 0.5rem 1rem;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(5px);
    max-width: 400px;
    margin-left: auto;
    margin-right: auto;
  }

  .admin-text {
    font-size: 0.9rem;
    font-weight: 400;
    color: #ffffff;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    line-height: 1.4;
  }

  .message {
    padding: 0.8rem 1.2rem;
    border-radius: 18px;
    margin-bottom: 0.5rem;
    max-width: 75%;
    display: flex;
    flex-direction: column;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  }

  .message.user {
    background: rgba(255, 255, 255, 0.1);
    align-self: flex-start;
    border-bottom-left-radius: 4px;
  }

  .message.ai {
    background: rgba(255, 107, 53, 0.2);
    align-self: flex-end;
    border-bottom-right-radius: 4px;
    text-align: right;
  }
  
  .sender {
    font-size: 0.8rem;
    font-weight: 600;
    color: #cccccc;
    margin-bottom: 0.2rem;
    opacity: 0.8;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  }

  .message.user .sender {
    color: #ffffff;
  }

  .message.ai .sender {
    color: #ff6b35;
  }

  .text {
    font-size: 1.25rem;
    font-weight: 500;
    word-break: break-all;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    color: #ffffff;
  }

  .connector {
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 1rem 0;
    color: #cccccc;
  }

  .arrow {
    font-size: 1.5rem;
    margin: 0 1rem;
    color: #cccccc;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  }

  .char {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 1.2rem;
    font-weight: bold;
    padding: 0.3rem 0.6rem;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .char.last {
    color: #ff6b35;
  }

  .char.first {
    color: #ff6b35;
  }

  footer {
    position: fixed;
    bottom: 5rem; /* footerの上に配置 */
    left: 50%;
    transform: translateX(-50%);
    z-index: 30;
  }

  .home-button {
    display: inline-block;
    padding: 0.8rem 2rem;
    backdrop-filter: blur(10px);
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
    text-decoration: none;
    font-weight: bold;
    border-radius: 50px;
    transition: all 0.3s ease;
    border: 1px solid rgba(255, 255, 255, 0.2);
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  }

  .home-button:hover {
    background: rgba(255, 107, 53, 0.1);
    transform: translateY(-2px);
    box-shadow: 0 12px 40px rgba(255, 107, 53, 0.2);
    scale: 1.05;
    color: #ff6b35;
    border-color: rgba(255, 107, 53, 0.3);
  }
</style>
