import { env } from '$env/dynamic/private';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

function toStatus(value: string | undefined) {
  if (!value) {
    return { configured: false, length: 0 };
  }
  return { configured: true, length: value.length };
}

export const GET: RequestHandler = async ({ request, url }) => {
  const requiredToken = env.DIAGNOSTIC_TOKEN;
  const providedToken =
    request.headers.get('x-diagnostic-token') ?? url.searchParams.get('token');

  // When DIAGNOSTIC_TOKEN is configured, require it for this endpoint.
  if (requiredToken && providedToken !== requiredToken) {
    throw error(401, 'Unauthorized diagnostics access');
  }

  const processEnv = typeof process !== 'undefined' ? process.env : undefined;
  const isCloudflarePages = processEnv?.CF_PAGES === '1' || !!processEnv?.CF_PAGES_BRANCH;

  const unsplash = toStatus(env.UNSPLASH_KEY);
  const gemini = toStatus(env.GEMINI_API_KEY);
  const diagnosticToken = toStatus(env.DIAGNOSTIC_TOKEN);

  return json({
    ok: unsplash.configured,
    timestamp: new Date().toISOString(),
    runtime: {
      environment: isCloudflarePages ? 'cloudflare' : 'local',
      cfPages: processEnv?.CF_PAGES ?? null,
      cfPagesBranch: processEnv?.CF_PAGES_BRANCH ?? null
    },
    variables: {
      UNSPLASH_KEY: unsplash,
      GEMINI_API_KEY: gemini,
      DIAGNOSTIC_TOKEN: diagnosticToken
    },
    notes: [
      'This endpoint returns configuration status only and never returns secret values.',
      'Set DIAGNOSTIC_TOKEN to require authentication for diagnostics.'
    ]
  });
};
