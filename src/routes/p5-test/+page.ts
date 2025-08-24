import type { PageLoad } from './$types';
import { error } from '@sveltejs/kit';

export const ssr = false;

export const load: PageLoad = async ({ url, fetch }) => {
  const keyword = url.searchParams.get('q');

  if (!keyword) {
    throw error(400, 'キーワードが必要です。URLの末尾に「?q=検索したい単語」を追加してください。');
  }

  console.log(`[p5-test client load] 「${keyword}」の画像を取得します。`);

  try {
    const response = await fetch(`/api/get-image?keyword=${encodeURIComponent(keyword)}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw error(response.status, `画像の取得に失敗しました: ${errorText}`);
    }
    
    const imageData = await response.json();

    return {
      imgUrl: imageData.img,
      altText: imageData.alt
    };
  } catch (err: any) {
    console.error('[p5-test client load] 画像取得エラー:', err);
    throw error(500, `画像の取得に失敗しました: ${err.message}`);
  }
};