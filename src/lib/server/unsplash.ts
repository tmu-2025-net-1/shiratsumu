import { env } from '$env/dynamic/private';
import { localImages } from '$lib/local-images';
import { getCachedImage, setCachedImage, updateLastUsed } from './image-cache';

export async function getUnsplashImage(keyword: string, fetch: typeof globalThis.fetch) {
  const q = keyword.toLowerCase();
  const isCloudflarePages = process.env.CF_PAGES === '1' || !!process.env.CF_PAGES_BRANCH;
  
  console.log(`[unsplash] Processing keyword: ${q}, Environment: ${isCloudflarePages ? 'Cloudflare' : 'Local'}`);

  // Cloudflare Pages環境でのFirestore操作は制限される可能性があるため、
  // より安全なアプローチでキャッシュを確認
  if (!isCloudflarePages) {
    // ローカル環境でのみFirestoreキャッシュを使用
    try {
      const cacheCheckStart = Date.now();
      const cachedImage = await Promise.race([
        getCachedImage(q),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Cache check timeout')), 5000)
        )
      ]) as any;
      
      if (cachedImage) {
        console.log(`[unsplash] Cache hit for ${q} (${Date.now() - cacheCheckStart}ms)`);
        await updateLastUsed(q).catch(err => 
          console.warn('[unsplash] Failed to update last used:', err.message)
        );
        return {
          img: cachedImage.imageUrl,
          alt: cachedImage.altText,
        };
      } else {
        console.log(`[unsplash] Cache miss for ${q} (${Date.now() - cacheCheckStart}ms)`);
      }
    } catch (error: any) {
      console.warn('[unsplash] Cache check failed, continuing without cache:', error.message);
      // キャッシュのエラーは無視して通常の処理を続行
    }
  } else {
    console.log('[unsplash] Skipping Firestore cache in Cloudflare environment');
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
      const errorMsg = 'UNSPLASH_KEY environment variable is not configured';
      console.error(`[unsplash] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    const apiUrl = `https://api.unsplash.com/photos/random?query=${encodeURIComponent(q)}&client_id=${apiKey}`;
    console.log(`[unsplash] Fetching from Unsplash API for: ${q}`);
    
    const fetchStart = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

    try {
      const res = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'SvelteKit-App/1.0'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const fetchTime = Date.now() - fetchStart;
      
      console.log(`[unsplash] API response received (${fetchTime}ms):`, {
        status: res.status,
        statusText: res.statusText,
        headers: Object.fromEntries(res.headers.entries())
      });

      if (!res.ok) {
        let errorDetails = 'Unknown error';
        try {
          const errorText = await res.text();
          errorDetails = errorText || `HTTP ${res.status}`;
        } catch (e) {
          errorDetails = `HTTP ${res.status} ${res.statusText}`;
        }
        throw new Error(`Unsplash API error (${res.status}): ${errorDetails}`);
      }

      const data = await res.json();
      
      if (!data || !data.urls || !data.urls.regular) {
        console.warn('[unsplash] Invalid response structure:', data);
        throw new Error('Invalid response from Unsplash API - missing image URLs');
      }

      const result = {
        img: data.urls.regular,
        alt: data.alt_description || data.description || q,
      };

      console.log(`[unsplash] Successfully obtained image for ${q}:`, {
        hasUrl: !!result.img,
        urlLength: result.img?.length,
        altText: result.alt
      });

      // Cloudflare環境ではFirestore保存をスキップ
      if (!isCloudflarePages) {
        try {
          console.log(`[unsplash] Caching to Firestore: ${q}`);
          await setCachedImage({
            keyword: q,
            imageUrl: result.img,
            altText: result.alt,
            isLocal: false,
          });
          console.log(`[unsplash] Successfully cached to Firestore: ${q}`);
        } catch (cacheError: any) {
          console.warn(`[unsplash] Failed to cache image for ${q}:`, cacheError.message);
          // キャッシュエラーは無視して結果を返す
        }
      } else {
        console.log('[unsplash] Skipping Firestore caching in Cloudflare environment');
      }

      return result;

    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        throw new Error(`Unsplash API request timed out after 20 seconds`);
      }
      throw fetchError;
    }

  } catch (error: any) {
    console.error(`[unsplash] Error occurred while processing ${q}:`, {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // より具体的なエラーメッセージを提供
    let enhancedError = error;
    if (error.message.includes('fetch')) {
      enhancedError = new Error(`Network error while fetching image for "${q}": ${error.message}`);
    } else if (error.message.includes('UNSPLASH_KEY')) {
      enhancedError = new Error(`Image service configuration error: ${error.message}`);
    } else if (error.message.includes('timeout')) {
      enhancedError = new Error(`Request timeout while fetching image for "${q}"`);
    }
    
    throw enhancedError;
  }
}