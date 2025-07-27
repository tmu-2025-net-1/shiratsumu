import { getUnsplashImage } from '$lib/server/unsplash';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, fetch }) => {
  const keyword = params.keyword;

  if (!keyword) {
    throw error(400, 'Keyword is required');
  }

  try {
    const imageData = await getUnsplashImage(keyword, fetch);
    
    return {
      img: imageData.img,
      alt: imageData.alt,
      keyword: keyword
    };
  } catch (err: any) {
    throw error(500, `画像の取得に失敗しました: ${err.message}`);
  }
};
