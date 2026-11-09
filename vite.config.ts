import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
export default defineConfig(({ command }) => {
  const buildId = command === 'serve' ? 'development' : randomUUID();
  const output = fileURLToPath(new URL('./dist-renderer', import.meta.url));
  return {
    plugins: [
      react(),
      {
        name: 'dogcow-local-diagnostic-artifacts',
        generateBundle() {
          this.emitFile({ type: 'asset', fileName: 'build-info.json', source: JSON.stringify({ buildId }) });
        },
        async closeBundle() {
          if (command === 'serve') return;
          const archive = fileURLToPath(new URL(`./build/diagnostics/${buildId}/assets`, import.meta.url));
          await mkdir(archive, { recursive: true });
          for (const name of await readdir(path.join(output, 'assets'))) {
            if (name.endsWith('.map')) await rename(path.join(output, 'assets', name), path.join(archive, name));
          }
          await writeFile(path.join(archive, '../build-info.json'), await readFile(path.join(output, 'build-info.json')));
        },
      },
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
    build: {
      outDir: '../../dist-renderer', emptyOutDir: true, sourcemap: 'hidden',
      rollupOptions: {
        input: {
          main: fileURLToPath(new URL('./src/renderer/index.html', import.meta.url)),
          playground: fileURLToPath(new URL('./src/renderer/playground.html', import.meta.url)),
        },
      },
    },
    server: { host: '127.0.0.1', port: 5180, strictPort: true },
  };
});
