import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

const apiPort = process.env.LUMIA_API_PORT ?? '4000';
const api = { target: `http://localhost:${apiPort}`, changeOrigin: true };
// Lumi serves AG-UI at /invocations; the web reaches it as /lumi/invocations.
const lumi = { target: `http://localhost:${process.env.LUMI_PORT ?? '8080'}`, changeOrigin: true, rewrite: (path: string) => path.replace(/^\/lumi/, '') };

// The dev server proxies the local API, its signed storage and Lumi on the same origin, so the browser needs no CORS.
export default defineConfig({
  plugins: [vue()],
  server: {
    port: Number(process.env.LUMIA_WEB_PORT ?? '5173'),
    strictPort: true,
    proxy: {
      '/graphql': api,
      '/dev/login': api,
      '/storage': api,
      '/lumi': lumi,
    },
  },
});
