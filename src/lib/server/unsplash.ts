import { env } from '$env/dynamic/private';
import { localImages } from '$lib/local-images';

export async function getUnsplashImage(keyword: string, fetch: typeof globalThis.fetch) {
  const q = keyword.toLowerCase();

  if (q in localImages) {
    const imgs = localImages[q];
    const img = imgs[Math.floor(Math.random() * imgs.length)];
    return {
      img,
      alt: `${q} (local)`,
    };
  }

  try {
    const apiKey = env.UNSPLASH_KEY;
    if (!apiKey) {
      throw new Error('UNSPLASH_KEY is not defined in .env file');
    }
    const apiUrl = `https://api.unsplash.com/photos/random?query=${encodeURIComponent(q)}&client_id=${apiKey}`;
    console.log(`[server] Fetching from Unsplash: ${apiUrl}`);
    const res = await fetch(apiUrl);

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Unsplash API error: ${res.status} ${res.statusText} - ${errorText}`);
    }

    const data = await res.json();
    return {
      img: data.urls.regular,
      alt: data.alt_description ?? q,
    };
  } catch (error: any) {
    console.error('[server] An error occurred in getUnsplashImage:', error.message);
    // 捕まえたエラーをそのまま呼び出し元に投げる
    // これにより、load関数がエラーを検知できるようになる
    throw error;
  }
}