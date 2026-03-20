import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter({
			routes: {
				// Keep Functions enabled for all routes without include/exclude overlap.
				include: ['/*'],
				exclude: []
			}
		}),
		
		// Service worker configuration
		serviceWorker: {
			register: false
		}
	}
};

export default config;
