/**
 * YBGP Loyalty - Production Full-Stack Server
 * Mounts Express API endpoints at /api/v1 and Vite dev middlewares on Port 3000.
 */

import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serverDb } from './server/db';
import { AuthService } from './server/auth';
import { createApiRouter } from './server/api';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  app.use(express.json());

  // Security Headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  // Database & Auth
  const authService = new AuthService(serverDb);

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'YBGP Loyalty SaaS', timestamp: new Date().toISOString() });
  });

  // Mount API Router at /api/v1
  const apiRouter = createApiRouter(serverDb, authService);
  app.use('/api/v1', apiRouter);

  // Mount Vite or Static Frontend
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: PORT,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve production static build
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[YBGP Loyalty Server] Running on http://0.0.0.0:${PORT} (env: ${isProduction ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('[YBGP Server Error]', err);
  process.exit(1);
});
