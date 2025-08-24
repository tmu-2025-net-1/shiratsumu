import type { PageLoad } from './$types';
import { error } from '@sveltejs/kit';

export const ssr = false;

export const load: PageLoad = async ({ params, url, fetch }) => {
  const keyword = params.keyword;
  const chars = url.searchParams.get('chars') ?? keyword;
  const sessionId = url.searchParams.get('s') ?? null;
  
  console.log(`[answer page load] URL: ${url.href}`);
  console.log(`[answer page load] SessionID: ${sessionId}`);
  console.log(`[answer page load] Keyword: ${keyword}`);

  if (!keyword) {
    throw error(400, 'Keyword is required');
  }

  try {
    // クライアント側でAPIを呼び出して画像を取得
    const response = await fetch(`/api/get-image?keyword=${encodeURIComponent(keyword)}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw error(response.status, `画像の取得に失敗しました: ${errorText}`);
    }
    
    const imageData = await response.json();
    
    console.log(`[client load] 「${keyword}」の画像を取得しました:`, imageData.img);
    
    return {
      img: imageData.img,
      altText: imageData.alt,
      q: keyword,
      chars: chars,
      sessionId: sessionId
    };
  } catch (err: any) {
    console.error('[client load] 画像取得エラー:', err);
    throw error(500, `画像の取得に失敗しました: ${err.message}`);
  }
};
