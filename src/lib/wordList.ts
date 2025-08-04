export const shiritoriWords: { [key: string]: string[] } = {
  a: ['apple', 'ant', 'airplane', 'anchor', 'arrow', 'axe', 'armchair', 'acorn'],
  b: ['ball', 'banana', 'bird', 'boat', 'book', 'bridge', 'bed', 'bottle', 'butterfly'],
  c: ['cat', 'car', 'cup', 'cloud', 'castle', 'camera', 'candle', 'coin', 'crab'],
  d: ['dog', 'desk', 'duck', 'door', 'drum', 'diamond', 'dragon', 'dolphin'],
  e: ['egg', 'elephant', 'eagle', 'eye', 'engine', 'envelope', 'eraser', 'ear'],
  f: ['fish', 'flower', 'fan', 'fork', 'fire', 'flag', 'feather', 'frog', 'fence'],
  g: ['goat', 'guitar', 'glass', 'glove', 'gate', 'ghost', 'grape', 'gem', 'giraffe'],
  h: ['house', 'hat', 'horse', 'hand', 'heart', 'hammer', 'helicopter', 'helmet'],
  i: ['ice', 'insect', 'island', 'iron', 'igloo', 'ink', 'ice cream', 'ivy'],
  j: ['jacket', 'jewel', 'jam', 'jeep', 'jellyfish', 'jar', 'jet', 'jug'],
  k: ['key', 'kite', 'kangaroo', 'king', 'knife', 'koala', 'kettle', 'knight'],
  l: ['lion', 'leaf', 'lamp', 'lemon', 'ladder', 'lake', 'lock', 'letter', 'lizard'],
  m: ['moon', 'mouse', 'mountain', 'mirror', 'map', 'motorcycle', 'mushroom', 'magnet', 'mask'],
  n: ['nest', 'nose', 'needle', 'notebook', 'nail', 'nut', 'necklace', 'net'],
  o: ['orange', 'octopus', 'owl', 'ocean', 'onion', 'oven', 'oil', 'oar'],
  p: ['pen', 'plane', 'pig', 'piano', 'pear', 'pencil', 'pizza', 'pyramid', 'penguin', 'pumpkin'],
  q: ['queen', 'quilt', 'quail', 'quarter', 'quiver', 'quill'], // qは条件に合う単語が少ないです
  r: ['rabbit', 'robot', 'rocket', 'ring', 'rain', 'river', 'road', 'roof', 'rose'],
  s: ['sun', 'star', 'snake', 'ship', 'sword', 'spoon', 'spider', 'strawberry', 'shoe', 'swing'],
  t: ['table', 'tiger', 'tree', 'train', 'tent', 'telephone', 'television', 'tomato', 'tower', 'turtle'],
  u: ['umbrella', 'unicorn', 'unicycle', 'uniform', 'ukulele', 'urn'],
  v: ['violin', 'vase', 'volcano', 'van', 'vegetable', 'vest', 'vine', 'vulture'],
  w: ['water', 'wolf', 'window', 'watch', 'wheel', 'whale', 'web', 'wing', 'worm'],
  x: ['xylophone', 'x-ray', 'xenops', 'xerus'], // xは引き続き条件に合う単語が少ないです
  y: ['yacht', 'yarn', 'yolk', 'yogurt', 'yo-yo', 'yardstick'],
  z: ['zebra', 'zipper', 'zoo', 'zigzag']
};

/**
 * 動的に単語を辞書に追加する関数
 * @param firstChar 単語の最初の文字（小文字）
 * @param word 追加する単語（小文字）
 */
export function addWordToDictionary(firstChar: string, word: string): void {
  if (!shiritoriWords[firstChar]) {
    shiritoriWords[firstChar] = [];
  }
  
  // 重複チェック
  if (!shiritoriWords[firstChar].includes(word)) {
    shiritoriWords[firstChar].push(word);
    console.log(`Added word "${word}" to dictionary under "${firstChar}"`);
  }
}