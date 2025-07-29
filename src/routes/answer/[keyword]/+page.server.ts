import type { PageServerLoad } from './$types';
import { getUnsplashImage } from '$lib/server/unsplash';
import { error } from '@sveltejs/kit';

export const ssr = false;

export const load: PageServerLoad = async ({ params, url, fetch }) => {
  // `params.keyword`からキーワードを取得する
  const keyword = params.keyword;
  const chars = url.searchParams.get('chars') ?? keyword;
  const sessionId = url.searchParams.get('s') ?? null; // セッションIDを取得

  if (!keyword) {
    throw error(400, 'Keyword is required');
  }

  try {
    const imageData = await getUnsplashImage(keyword, fetch);
    
    console.log(`[load function] Unsplashで「${keyword}」の画像を取得しました:`, imageData.img);
    
    // p5-testと同じ構造でデータを返す
    return {
      img: imageData.img,
      altText: imageData.alt,
      q: keyword,
      chars: chars,
      sessionId: sessionId
    };
  } catch (err: any) {
    throw error(500, `画像の取得に失敗しました: ${err.message}`);
  }
};
