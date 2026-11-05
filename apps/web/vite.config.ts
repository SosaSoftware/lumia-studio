import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

const apiPort = process.env.LUMIA_API_PORT ?? '4000';
const api = { target: `http://localhost:${apiPort}`, changeOrigin: true };

// The dev server proxies the local API and its signed storage on the same origin, so the browser needs no CORS.
export default defineConfig({
  plugins: [vue()],
  server: {
    port: Number(process.env.LUMIA_WEB_PORT ?? '5173'),
    strictPort: true,
    proxy: {
      '/graphql': api,
      '/dev/login': api,
      '/storage': api,
    },
  },
});
