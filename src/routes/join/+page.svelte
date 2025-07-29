<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { doc, getDoc } from 'firebase/firestore';
  import { db } from '$lib/firebase';

  let statusMessage = 'PCから情報を取得中...';

  onMount(async () => {
    // 1. URLからセッションIDを取得
    const sessionId = $page.url.searchParams.get('s');

    if (!sessionId) {
      statusMessage = 'エラー: セッションIDが見つかりません。';
      return;
    }

    try {
      // 2. セッションIDを元にFirestoreからデータを取得
      const sessionRef = doc(db, 'sessions', sessionId);
      const docSnap = await getDoc(sessionRef);

      if (docSnap.exists()) {
        // 3. データを取得できたら、そのキーワードを使ってASCIIページへ移動
        const keyword = docSnap.data().keyword;
        // statusMessage = `「${keyword}」のページへ移動します...`;
        
        // /ascii/[keyword] ページへジャンプ（セッションIDもパラメータとして渡す）
        await goto(`/ascii/${encodeURIComponent(keyword)}?s=${encodeURIComponent(sessionId)}`);

      } else {
        statusMessage = 'エラー: 無効なセッションです。';
      }
    } catch (error) {
      statusMessage = 'エラー: データの取得に失敗しました。';
      console.error(error);
    }
  });
</script>

<main>
  <h1>Loading...</h1>
  <p>{statusMessage}</p>
</main>

<style>
  main {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 100vh;
    font-family: sans-serif;
    background-color: black;
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