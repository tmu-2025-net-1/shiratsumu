import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		// adapter-auto detects Cloudflare Pages automatically
		adapter: adapter(),
		
		// Service worker configuration
		serviceWorker: {
			register: false
		}
	}
};

export default config;
