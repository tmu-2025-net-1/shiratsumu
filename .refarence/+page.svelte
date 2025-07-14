<!-- 画像API成功例 -->
<script lang="ts">
  export let data: {
    img:  string;
    alt:  string;
    q:    string;
    chars: string;
  };
</script>

{#if data.img}
  背景画像で貼り付ける方法（object-fit より軽い）
  <div
    class="hero"
    style="background-image: url('{data.img}')"
    role="img"
    aria-label={data.alt}
  ></div>
{:else}
  <p class="error">“{data.q}” に合う画像が見つかりませんでした。</p>
{/if}

<style>
  /* ブラウザいっぱいに広げる */
  :global(html), :global(body), .hero { margin: 0; padding: 0; width: 100%; height: 100vh; }

  .hero  {
    background-size: cover;       /* 縦横比を保ったまま拡大 */
    background-position: center;  /* 画像の中央を基準にトリム */
  }

  .error { display:flex; justify-content:center; align-items:center; height:100vh; }
</style> 