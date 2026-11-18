import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import express from 'express';
import { translateRequestBody } from './lib/translate.js';

const rootDir = import.meta.dirname;
const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.post('/api/translate', async (req, res) => {
    const result = await translateRequestBody(req.body);
    return res.status(result.status).json(result.body);
  });

  app.use((req, res, next) => {
    if (req.path === '/admin') {
      const queryIndex = req.originalUrl.indexOf('?');
      const query = queryIndex >= 0 ? req.originalUrl.slice(queryIndex) : '';
      return res.redirect(301, `/admin/${query}`);
    }
    return next();
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(rootDir, 'admin-deploy');
    app.use(express.static(distDir));
  } else {
    const adminRequire = createRequire(path.resolve(rootDir, 'admin/package.json'));
    const viteEntry = adminRequire.resolve('vite');
    const { createServer } = await import(pathToFileURL(viteEntry).href);
    const vite = await createServer({
      configFile: path.resolve(rootDir, 'admin/vite.config.js'),
      server: { middlewareMode: true },
      appType: 'mpa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Bookroom TV server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start Bookroom TV server:', error);
  process.exit(1);
});
