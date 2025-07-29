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
        {#each conversation as message, i}
          <!-- adminのメッセージは表示しない -->
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
  :global(body) {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    background-color: #1a1a1a;
    color: #f0f0f0;
    margin: 0;
  }

  .container {
    max-width: 600px;
    margin: 0 auto;
    padding: 2rem 1.5rem;
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    box-sizing: border-box;
  }

  header {
    text-align: center;
    border-bottom: 1px solid #444;
    padding-bottom: 1.5rem;
    margin-bottom: 2rem;
  }

  h1 {
    font-size: 2.5rem;
    font-weight: 700;
    color: #fff;
    margin: 0 0 0.5rem 0;
  }

  .summary {
    font-size: 1.1rem;
    color: #aaa;
  }

  .count {
    font-weight: bold;
    font-size: 1.5rem;
    color: #88d8ff;
  }

  main {
    flex-grow: 1;
  }

  .status {
    text-align: center;
    color: #888;
    font-size: 1.1rem;
    padding: 3rem 0;
  }
  .status.error {
    color: #ff8a8a;
  }

  .timeline {
    display: flex;
    flex-direction: column;
  }

  .message {
    padding: 0.8rem 1.2rem;
    border-radius: 18px;
    margin-bottom: 0.5rem;
    max-width: 75%;
    display: flex;
    flex-direction: column;
    box-shadow: 0 4px 10px rgba(0,0,0,0.2);
  }

  .message.user {
    background-color: #005c99;
    align-self: flex-start;
    border-bottom-left-radius: 4px;
  }

  .message.ai {
    background-color: #3a3a3a;
    align-self: flex-end;
    border-bottom-right-radius: 4px;
    text-align: right;
  }
  
  .sender {
    font-size: 0.8rem;
    font-weight: 600;
    color: #bbb;
    margin-bottom: 0.2rem;
    opacity: 0.8;
  }

  .message.user .sender {
    color: #b3e0ff;
  }

  .text {
    font-size: 1.25rem;
    font-weight: 500;
    word-break: break-all;
  }

  .connector {
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 1rem 0;
    color: #777;
  }

  .arrow {
    font-size: 1.5rem;
    margin: 0 1rem;
    color: #666;
  }

  .char {
    font-family: monospace;
    font-size: 1.2rem;
    font-weight: bold;
    padding: 0.3rem 0.6rem;
    border-radius: 50%;
    background-color: #2c2c2c;
  }

  .char.last {
    color: #ffb3b3;
  }

  .char.first {
    color: #b3ffb3;
  }

  footer {
    text-align: center;
    margin-top: 3rem;
  }

  .home-button {
    display: inline-block;
    padding: 0.8rem 2rem;
    background-color: #88d8ff;
    color: #111;
    text-decoration: none;
    font-weight: bold;
    border-radius: 50px;
    transition: all 0.2s ease;
  }

  .home-button:hover {
    background-color: #fff;
    transform: translateY(-2px);
    box-shadow: 0 6px 15px rgba(136, 216, 255, 0.2);
  }
</style>
