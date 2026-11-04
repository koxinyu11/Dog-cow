import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'dogcow-csp',
      transformIndexHtml(html, context) {
        return context.server
          ? html.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")
          : html.replace("connect-src 'self' ws://127.0.0.1:5180", "connect-src 'none'");
      },
    },
  ],
  root: 'src/renderer',
  base: './',
  build: { outDir: '../../dist-renderer', emptyOutDir: true },
  server: { host: '127.0.0.1', port: 5180, strictPort: true },
});
