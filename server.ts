import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import express from 'express';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

interface TranslateRequestItem {
  id?: string;
  fields: Record<string, string>;
}

interface FlatTranslationRow {
  index: number;
  key: string;
  en: string;
  de: string;
  it: string;
}

interface LanguageMaps {
  en: Record<string, string>;
  de: Record<string, string>;
  it: Record<string, string>;
}

const rootDir = import.meta.dirname;
const PORT = Number(process.env.PORT) || 3000;

function createGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function generateWithRetry(ai: GoogleGenAI, payload: Array<{ index: number; fields: Record<string, string> }>) {
  const maxAttempts = 2;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const startedAt = Date.now();
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: JSON.stringify({ items: payload }),
        config: {
          abortSignal: AbortSignal.timeout(15000),
          systemInstruction: [
            'You are a professional hospitality translator for a luxury hotel guest TV system.',
            'Translate each item\'s text fields from Bosnian/Croatian/Serbian (or source language) into natural, polite English (en), German (de), and Italian (it).',
            'Preserve exact index and key values, numbers, opening hours, phone numbers, URLs, and line breaks.',
            'Keep proper hotel, restaurant, or brand names intact when appropriate while translating descriptive terms naturally.',
            'Return ONLY valid JSON of shape {"translations":[{"index":number,"key":string,"en":string,"de":string,"it":string}]} with one row for every (index, key) pair provided.',
          ].join(' '),
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
          responseMimeType: 'application/json',
        },
      });
      console.log(`[Translate API] Gemini responded in ${Date.now() - startedAt}ms`);
      return response;
    } catch (error: unknown) {
      lastError = error;
      console.error(`[Translate API Attempt ${attempt}/${maxAttempts} Failed after ${Date.now() - startedAt}ms]`, error);
      const isTimeout = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
      const status = typeof error === 'object' && error !== null && 'status' in error
        ? Number((error as { status?: number }).status)
        : 0;
      const isRetryable = !isTimeout && (status === 429 || status >= 500 || status === 0);
      if (!isRetryable || attempt === maxAttempts) break;
      await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
    }
  }

  throw lastError;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.post('/api/translate', async (req, res) => {
    try {
      const items = req.body?.items as TranslateRequestItem[] | undefined;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Polje "items" mora sadržavati bar jedan unos za prevod.' });
      }

      const normalized = items.map((item, index) => {
        const cleanFields: Record<string, string> = {};
        if (item && item.fields && typeof item.fields === 'object') {
          for (const [key, val] of Object.entries(item.fields)) {
            if (typeof val === 'string' && val.trim().length > 0) {
              cleanFields[key] = val.trim();
            }
          }
        }
        return { index, fields: cleanFields };
      });

      const nonEmpty = normalized.filter((item) => Object.keys(item.fields).length > 0);
      if (nonEmpty.length === 0) {
        const emptyResult: LanguageMaps[] = items.map(() => ({ en: {}, de: {}, it: {} }));
        return res.json({ translations: emptyResult });
      }

      const ai = createGeminiClient();
      if (!ai) {
        return res.status(503).json({
          error: 'GEMINI_API_KEY nije podešen na serveru. Provjerite Settings > Secrets.',
        });
      }

      const response = await generateWithRetry(ai, nonEmpty);
      const rawJson = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawJson) as { translations?: FlatTranslationRow[] };
      const byIndex = new Map<number, LanguageMaps>();

      if (Array.isArray(parsed.translations)) {
        for (const row of parsed.translations) {
          if (typeof row?.index !== 'number' || typeof row?.key !== 'string') continue;
          let bucket = byIndex.get(row.index);
          if (!bucket) {
            bucket = { en: {}, de: {}, it: {} };
            byIndex.set(row.index, bucket);
          }
          if (typeof row.en === 'string') bucket.en[row.key] = row.en;
          if (typeof row.de === 'string') bucket.de[row.key] = row.de;
          if (typeof row.it === 'string') bucket.it[row.key] = row.it;
        }
      }

      const translations: LanguageMaps[] = normalized.map((entry) => {
        const keys = Object.keys(entry.fields);
        if (keys.length === 0) return { en: {}, de: {}, it: {} };
        const bucket = byIndex.get(entry.index);
        if (!bucket) {
          throw new Error('Model nije vratio prevod za sve stavke.');
        }
        const filtered: LanguageMaps = { en: {}, de: {}, it: {} };
        for (const key of keys) {
          if (typeof bucket.en[key] === 'string') filtered.en[key] = bucket.en[key];
          if (typeof bucket.de[key] === 'string') filtered.de[key] = bucket.de[key];
          if (typeof bucket.it[key] === 'string') filtered.it[key] = bucket.it[key];
        }
        return filtered;
      });

      return res.json({ translations });
    } catch (error: unknown) {
      console.error('[Translate API Error]', error);
      const status = typeof error === 'object' && error !== null && 'status' in error
        ? Number((error as { status?: number }).status)
        : 500;
      const message = error instanceof Error ? error.message : 'Prevod putem Gemini API-ja nije uspio.';
      return res.status(status >= 400 && status < 600 ? status : 500).json({ error: message });
    }
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
