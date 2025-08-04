import { db } from '$lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export interface CachedImage {
  keyword: string;
  imageUrl: string;
  altText: string;
  isLocal: boolean;
  createdAt: Date;
  lastUsedAt: Date;
}

/**
 * Firestoreから画像データを取得
 */
export async function getCachedImage(keyword: string): Promise<CachedImage | null> {
  try {
    const docRef = doc(db, 'image-cache', keyword);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        keyword: data.keyword,
        imageUrl: data.imageUrl,
        altText: data.altText,
        isLocal: data.isLocal,
        createdAt: data.createdAt.toDate(),
        lastUsedAt: data.lastUsedAt.toDate(),
      };
    }
    return null;
  } catch (error) {
    console.error('[image-cache] Error getting cached image:', error);
    return null;
  }
}

/**
 * Firestoreに画像データを保存
 */
export async function setCachedImage(imageData: {
  keyword: string;
  imageUrl: string;
  altText: string;
  isLocal: boolean;
}): Promise<void> {
  try {
    const now = new Date();
    const docRef = doc(db, 'image-cache', imageData.keyword);
    
    await setDoc(docRef, {
      keyword: imageData.keyword,
      imageUrl: imageData.imageUrl,
      altText: imageData.altText,
      isLocal: imageData.isLocal,
      createdAt: now,
      lastUsedAt: now,
    });
    
    console.log(`[image-cache] Cached image for keyword: ${imageData.keyword}`);
  } catch (error) {
    console.error('[image-cache] Error caching image:', error);
    throw error;
  }
}

/**
 * 最後の使用日時を更新
 */
export async function updateLastUsed(keyword: string): Promise<void> {
  try {
    const docRef = doc(db, 'image-cache', keyword);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      await setDoc(docRef, {
        ...docSnap.data(),
        lastUsedAt: new Date(),
      });
    }
  } catch (error) {
    console.error('[image-cache] Error updating last used:', error);
  }
}
