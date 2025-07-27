import type { PageServerLoad } from './$types';
import { getUnsplashImage } from '$lib/server/unsplash'; // 実際の画像取得関数をインポート
import { error } from '@sveltejs/kit';

export const ssr = false;

export const load: PageServerLoad = async ({ url, fetch }) => {
  // URLのクエリパラメータからキーワードを取得 (例: /p5-test?q=moon)
  const keyword = url.searchParams.get('q');

  // キーワードがなければエラーを返す
  if (!keyword) {
    throw error(400, 'キーワードが必要です。URLの末尾に「?q=検索したい単語」を追加してください。');
  }

  console.log(`[load function] Unsplashで「${keyword}」を検索します。`);

  try {
    // 実際にUnsplash(またはローカル)から画像データを取得
    const imageData = await getUnsplashImage(keyword, fetch);

    // p5.jsに渡すデータを返す
    return {
      imgUrl: imageData.img,
      altText: imageData.alt
    };

  } catch (err: any) {
    console.error('[load function] 画像の取得に失敗しました:', err.message);
    throw error(500, `画像の取得に失敗しました: ${err.message}`);
  }
};