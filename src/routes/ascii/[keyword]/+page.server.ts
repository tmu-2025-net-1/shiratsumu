// src/routes/ascii/[keyword]/+page.server.ts
import type { PageServerLoad } from './$types';
import { env } from '$env/dynamic/private'; 
import { localImages } from '$lib/local-images';

export const load: PageServerLoad = async ({ params, fetch, url }) => {
  const q       = params.keyword.toLowerCase();
  const chars   = url.searchParams.get('chars') ?? 'あいうえお';

  /* 1) まず「当たり」判定 ------------------------------------- */
  if (q in localImages) {
    // 複数あればランダムで 1 枚
    const imgs = localImages[q];
    const img  = imgs[Math.floor(Math.random() * imgs.length)];

    return {
      img,                       // ← static のパスをそのまま返す
      alt: `${q} (local)`,
      q:   q,
      chars
    };
  }

  /* 2) 外れなら Unsplash へフォールバック ---------------------- */
  const apiKey  = env.UNSPLASH_KEY;
  const apiUrl  = `https://api.unsplash.com/photos/random?query=${encodeURIComponent(q)}&client_id=${apiKey}`;

  const res     = await fetch(apiUrl);
  const data    = await res.json();

  return {
    img:  data.urls.regular, // p5 用
    alt:  data.alt_description ?? q,
    q,
    chars
  };
};