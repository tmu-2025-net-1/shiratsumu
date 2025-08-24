import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// adapter-auto detects Cloudflare Pages automatically
		adapter: adapter(),
		
		// Cloudflare Pages compatibility settings
		env: {
			publicPrefix: 'PUBLIC_',
		},
		
		// Enhanced error handling for production
		serviceWorker: {
			register: false
		},
		
		// CSP configuration for better security
		csp: {
			mode: 'auto',
			directives: {
				'script-src': ['self', 'unsafe-inline', 'unsafe-eval'],
				'style-src': ['self', 'unsafe-inline'],
				'img-src': ['self', 'data:', 'https:'],
				'connect-src': ['self', 'https:']
			}
		}
	},

	// Cloudflare Pages optimizations
	compilerOptions: {
		dev: process.env.NODE_ENV === 'development'
	}
};

export default config;
