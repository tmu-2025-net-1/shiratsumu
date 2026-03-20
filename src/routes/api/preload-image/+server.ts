import { json } from '@sveltejs/kit';
import { getUnsplashImage } from '$lib/server/unsplash';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, fetch }) => {
  const startTime = Date.now();
  let step = 'initialization';
  
  try {
    console.log('[preload-image] API called at', new Date().toISOString());
    console.log('[preload-image] Runtime environment:', {
      userAgent: request.headers.get('user-agent'),
      cfRay: request.headers.get('cf-ray'),
      cfIpCountry: request.headers.get('cf-ipcountry'),
      contentType: request.headers.get('content-type')
    });

    // Step 1: Request body parsing
    step = 'parsing request body';
    let keyword: string;
    
    try {
      const contentType = request.headers.get('content-type') || '';
      
      if (!contentType.includes('application/json')) {
        console.warn('[preload-image] Invalid content type:', contentType);
        return json({
          success: false,
          error: 'Content-Type must be application/json',
          step: step
        }, { status: 400 });
      }

      const body = await request.json();
      console.log('[preload-image] Request body parsed:', { 
        hasKeyword: !!body?.keyword,
        keywordType: typeof body?.keyword,
        bodyKeys: Object.keys(body || {})
      });
      
      keyword = body?.keyword;
    } catch (parseError: any) {
      console.error('[preload-image] JSON parsing error:', parseError);
      return json({
        success: false,
        error: `Failed to parse request body: ${parseError.message}`,
        step: step
      }, { status: 400 });
    }

    // Step 2: Input validation
    step = 'validating input';
    if (!keyword || typeof keyword !== 'string' || keyword.trim().length === 0) {
      console.warn('[preload-image] Invalid keyword:', { keyword, type: typeof keyword });
      return json({
        success: false,
        error: 'Keyword is required and must be a non-empty string',
        step: step
      }, { status: 400 });
    }

    keyword = keyword.trim();
    console.log('[preload-image] Processing keyword:', keyword);

    // Step 3: Environment check
    step = 'environment check';
    const processEnv = typeof process !== 'undefined' ? process.env : undefined;
    const isCloudflarePages = processEnv?.CF_PAGES === '1' || !!processEnv?.CF_PAGES_BRANCH;
    const environment = {
      isCloudflare: isCloudflarePages,
      nodeVersion: typeof process !== 'undefined' ? process.version : 'n/a',
      platform: typeof process !== 'undefined' ? process.platform : 'n/a',
      cfPages: processEnv?.CF_PAGES ?? null,
      cfBranch: processEnv?.CF_PAGES_BRANCH ?? null
    };
    console.log('[preload-image] Environment info:', environment);

    // Step 4: Image acquisition with timeout
    step = 'acquiring image';
    const TIMEOUT_MS = 25000; // Cloudflare Workers timeout is typically 30s
    
    const imagePromise = getUnsplashImage(keyword, fetch);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Operation timed out')), TIMEOUT_MS);
    });

    const imageData = await Promise.race([imagePromise, timeoutPromise]) as any;
    
    const processingTime = Date.now() - startTime;
    console.log('[preload-image] Image acquired successfully:', {
      keyword,
      processingTime,
      hasImage: !!imageData?.img,
      imageUrl: imageData?.img?.substring(0, 50) + '...'
    });

    // Step 5: Response generation
    step = 'generating response';
    return json({
      success: true,
      img: imageData.img,
      alt: imageData.alt,
      keyword: keyword,
      cached: true,
      metadata: {
        processingTime,
        step: 'completed',
        environment: isCloudflarePages ? 'cloudflare' : 'local'
      }
    });

  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    
    // Enhanced error logging
    console.error('[preload-image] Error occurred:', {
      step,
      processingTime,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
        cause: error.cause
      },
      timestamp: new Date().toISOString()
    });

    // Specific error handling for different failure modes
    let errorMessage = error.message || 'Unknown error occurred';
    let statusCode = 500;

    if (error.message?.includes('timeout') || error.message?.includes('TIMEOUT')) {
      errorMessage = 'Request timed out - please try again';
      statusCode = 504;
    } else if (error.message?.includes('UNSPLASH_KEY')) {
      errorMessage = 'Image service configuration error';
      statusCode = 503;
    } else if (error.message?.includes('fetch')) {
      errorMessage = 'External service unavailable';
      statusCode = 503;
    }

    return json({
      success: false,
      error: errorMessage,
      step: step,
      metadata: {
        processingTime,
        timestamp: new Date().toISOString()
      }
    }, { status: statusCode });
  }
};
