import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendTarget = (env.BACKEND_URL || env.VITE_BACKEND_URL || 'http://localhost:8000').replace(/\/+$/, '');

  console.log(`[Vite] Proxying API routes to backend: ${backendTarget}`);

  const proxyConfig = {
    target: backendTarget,
    changeOrigin: true,
    secure: false,
    ws: true,
  };

  return {
    plugins: [
      react(),
      {
        name: 'serve-public-index-html',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const url = req.url ? req.url.split('?')[0] : '';
            if (url === '/' || url === '/index.html' || url === '/login.html' || url === '/login') {
              const indexPath = path.resolve(__dirname, 'public/index.html');
              let html = fs.readFileSync(indexPath, 'utf-8');
              html = await server.transformIndexHtml(req.url, html);
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              res.end(html);
              return;
            }
            next();
          });
        },
        closeBundle() {
          const publicDist = path.resolve(__dirname, 'dist/public/index.html');
          const rootDist = path.resolve(__dirname, 'dist/index.html');
          if (fs.existsSync(publicDist)) {
            fs.copyFileSync(publicDist, rootDist);
            try {
              fs.unlinkSync(publicDist);
              fs.rmdirSync(path.resolve(__dirname, 'dist/public'));
            } catch {}
          }
        }
      }
    ],
    build: {
      rollupOptions: {
        input: path.resolve(__dirname, 'public/index.html'),
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-xlsx': ['xlsx']
          }
        }
      }
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'xlsx']
    },
    server: {
      port: 3000,
      host: true,
      open: false,
      // Every API call goes through /api/v1 (see src/api/*.js), which is the prefix
      // the backend mounts. The bare /vobs, /dashboard, /users … entries that used to
      // sit here matched nothing and are gone.
      proxy: {
        '/api': proxyConfig,
      }
    }
  };
});
