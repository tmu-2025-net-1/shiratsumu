import type { RequestHandler } from './$types';
import { getUnsplashImage } from '$lib/server/unsplash';
import { json, error } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ url, fetch }) => {
  const keyword = url.searchParams.get('keyword');
  
  if (!keyword) {
    throw error(400, 'keyword parameter is required');
  }

  try {
    const imageData = await getUnsplashImage(keyword, fetch);
    
    return json({
      img: imageData.img,
      alt: imageData.alt
    });
  } catch (err: any) {
    console.error(`[get-image API] Error for keyword "${keyword}":`, err);
    throw error(500, `画像の取得に失敗しました: ${err.message}`);
  }
};