/**
 * 「キーワード -> 画像パス[]」の対応表
 * └ ファイルパスは必ず `/images/...` で始める
 */
export const localImages: Record<string, string[]> = {
  // 例：/ascii/river でヒット
  river: [
    '/images/river/river01.jpg',
    '/images/river/river02.jpg',
    '/images/river/river03.jpg',
    '/images/river/river04.jpg',
  ],

  // 例：/ascii/mountain
  mountain: ['/images/mountain/mountain01.jpg'],

  // 例：/ascii/mascot
  //   mascot: ['/images/mascot.jpg']

  moon: [
    '/images/moon/moon01.jpg',
  ],

  wanpi: [
    '/images/wanpi/wanpi01.jpg',
    '/images/wanpi/wanpi02.jpg',
  ],

  plane:[
    '/images/plane/plane01.jpg',
  ],

  tete:[
    '/images/tete/tete01.jpg',
    '/images/tete/tete02.jpg',
  ]
};

/** 「当たり一覧」を配列でほしい時に便利 */
export const localKeys = Object.keys(localImages);