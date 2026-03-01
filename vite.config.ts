import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		// host: true allows the server to be accessed via the local network IP
		host: true
	}
});
