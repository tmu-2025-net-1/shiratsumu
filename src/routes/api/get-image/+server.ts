import type { RequestHandler } from './$types';
import { getUnsplashImage } from '$lib/server/unsplash';
import { json, error } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ url, fetch }) => {
  const startTime = Date.now();
  let step = 'initialization';
  
  try {
    console.log('[get-image] API called at', new Date().toISOString());
    
    // Step 1: Parameter validation
    step = 'parameter validation';
    const keyword = url.searchParams.get('keyword');
    
    if (!keyword || keyword.trim().length === 0) {
      console.warn('[get-image] Missing or empty keyword parameter');
      throw error(400, 'keyword parameter is required and must be non-empty');
    }

    const cleanKeyword = keyword.trim();
    console.log(`[get-image] Processing keyword: ${cleanKeyword}`);

    // Step 2: Environment detection
    step = 'environment detection';
    const isCloudflarePages = process.env.CF_PAGES === '1' || !!process.env.CF_PAGES_BRANCH;
    console.log(`[get-image] Environment: ${isCloudflarePages ? 'Cloudflare Pages' : 'Local'}`);

    // Step 3: Image acquisition with timeout
    step = 'image acquisition';
    const TIMEOUT_MS = 25000; // 25 second timeout for Cloudflare compatibility
    
    const imagePromise = getUnsplashImage(cleanKeyword, fetch);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Image acquisition timed out')), TIMEOUT_MS);
    });

    const imageData = await Promise.race([imagePromise, timeoutPromise]) as any;
    
    const processingTime = Date.now() - startTime;
    console.log(`[get-image] Successfully acquired image for "${cleanKeyword}" in ${processingTime}ms`);

    // Step 4: Response validation
    step = 'response validation';
    if (!imageData || !imageData.img) {
      throw new Error('Invalid image data received');
    }

    return json({
      img: imageData.img,
      alt: imageData.alt,
      metadata: {
        keyword: cleanKeyword,
        processingTime,
        environment: isCloudflarePages ? 'cloudflare' : 'local',
        timestamp: new Date().toISOString()
      }
    });

  } catch (err: any) {
    const processingTime = Date.now() - startTime;
    
    console.error(`[get-image] Error in step "${step}" for keyword "${url.searchParams.get('keyword')}":`, {
      message: err.message,
      stack: err.stack,
      processingTime,
      timestamp: new Date().toISOString()
    });

    // Enhanced error messages
    let errorMessage = err.message || 'Unknown error occurred';
    let statusCode = 500;

    if (err.message?.includes('timeout') || err.message?.includes('TIMEOUT')) {
      errorMessage = 'Image acquisition timed out - please try again';
      statusCode = 504;
    } else if (err.message?.includes('UNSPLASH_KEY')) {
      errorMessage = 'Image service configuration error';
      statusCode = 503;
    } else if (err.message?.includes('fetch') || err.message?.includes('network')) {
      errorMessage = 'Network error while fetching image';
      statusCode = 503;
    } else if (err.status === 400) {
      statusCode = 400; // Keep validation errors as 400
    }

    throw error(statusCode, errorMessage);
  }
};