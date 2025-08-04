import { env } from '$env/dynamic/private';
import { localImages } from '$lib/local-images';
import { getCachedImage, setCachedImage, updateLastUsed } from './image-cache';

export async function getUnsplashImage(keyword: string, fetch: typeof globalThis.fetch) {
  const q = keyword.toLowerCase();

  // まずFirestoreのキャッシュを確認
  try {
    const cachedImage = await getCachedImage(q);
    if (cachedImage) {
      console.log(`[server] Using cached image for keyword: ${q}`);
      await updateLastUsed(q);
      return {
        img: cachedImage.imageUrl,
        alt: cachedImage.altText,
      };
    }
  } catch (error) {
    console.error('[server] Error checking cache:', error);
    // キャッシュのエラーは無視して通常の処理を続行
  }

  // ローカル画像をチェック
  if (q in localImages) {
    const imgs = localImages[q];
    const img = imgs[Math.floor(Math.random() * imgs.length)];
    const result = {
      img,
      alt: `${q} (local)`,
    };

    // ローカル画像もFirestoreに記録
    try {
      await setCachedImage({
        keyword: q,
        imageUrl: img,
        altText: result.alt,
        isLocal: true,
      });
    } catch (error) {
      console.error('[server] Error caching local image:', error);
    }

    return result;
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
    const result = {
      img: data.urls.regular,
      alt: data.alt_description ?? q,
    };

    // Unsplash画像もFirestoreに記録
    try {
      await setCachedImage({
        keyword: q,
        imageUrl: result.img,
        altText: result.alt,
        isLocal: false,
      });
    } catch (error) {
      console.error('[server] Error caching Unsplash image:', error);
    }

    return result;
  } catch (error: any) {
    console.error('[server] An error occurred in getUnsplashImage:', error.message);
    // 捕まえたエラーをそのまま呼び出し元に投げる
    // これにより、load関数がエラーを検知できるようになる
    throw error;
  }
}