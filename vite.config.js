import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		logger: 'basic',
		// Allow requests from inside the Playwright Docker container (which
		// reaches the host's preview server via host.docker.internal) and
		// from any local interface during dev.
		allowedHosts: ['host.docker.internal', 'localhost', '127.0.0.1']
	},
	preview: {
		allowedHosts: ['host.docker.internal', 'localhost', '127.0.0.1']
	}
});
