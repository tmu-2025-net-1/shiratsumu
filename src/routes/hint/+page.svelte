<script lang="ts"> export let data: { hits: string[] };</script>

<h1>Hint-当たりキーワード一覧</h1>
<ul>
  {#each data.hits as key}
    <li><a href={`/ascii/${key}`}>{key}</a></li>
  {/each}
</ul>

<a href="/">Home</a>

<style>
  :global(body) {
    margin: 0;
    padding: 20px;
    background: #fff;
    color: #000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
  
  h1 {
    color: #333;
    margin-bottom: 20px;
  }
  
  ul {
    list-style-type: disc;
    padding-left: 20px;
    margin-bottom: 30px;
  }
  
  li {
    margin-bottom: 8px;
  }
  
  a {
    color: #0070f3;
    text-decoration: none;
  }
  
  a:hover {
    text-decoration: underline;
  }
</style>