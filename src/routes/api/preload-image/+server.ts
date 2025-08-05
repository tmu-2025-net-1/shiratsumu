import { json } from '@sveltejs/kit';
import { getUnsplashImage } from '$lib/server/unsplash';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, fetch }) => {
  try {
    const { keyword } = await request.json();
    
    if (!keyword) {
      return json({ success: false, error: 'Keyword is required' }, { status: 400 });
    }

    console.log('[preload-image] 画像事前取得開始:', keyword);
    const imageData = await getUnsplashImage(keyword, fetch);
    
    console.log('[preload-image] 画像事前取得完了:', keyword, 'URL:', imageData.img);
    console.log('[preload-image] Firestoreキャッシュに保存されました');
    
    return json({
      success: true,
      img: imageData.img,
      alt: imageData.alt,
      keyword: keyword,
      cached: true // キャッシュされたことを明示
    });
    
  } catch (error: any) {
    console.error('[preload-image] 画像事前取得エラー:', error.message);
    return json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
};
