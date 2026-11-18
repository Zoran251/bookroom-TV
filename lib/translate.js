import { GoogleGenAI, ThinkingLevel } from '@google/genai';

function createGeminiClient() {
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

async function generateWithRetry(ai, payload) {
  const maxAttempts = 2;
  let lastError = null;

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
    } catch (error) {
      lastError = error;
      console.error(`[Translate API Attempt ${attempt}/${maxAttempts} Failed after ${Date.now() - startedAt}ms]`, error);
      const isTimeout = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
      const status = typeof error === 'object' && error !== null && 'status' in error
        ? Number(error.status)
        : 0;
      const isRetryable = !isTimeout && (status === 429 || status >= 500 || status === 0);
      if (!isRetryable || attempt === maxAttempts) break;
      await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
    }
  }

  throw lastError;
}

export async function translateRequestBody(rawBody) {
  let body = rawBody;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return {
        status: 400,
        body: { error: 'Neispravan JSON format zahtjeva.' },
      };
    }
  }

  const items = body?.items;
  if (!Array.isArray(items) || items.length === 0) {
    return {
      status: 400,
      body: { error: 'Polje "items" mora sadržavati bar jedan unos za prevod.' },
    };
  }

  const normalized = items.map((item, index) => {
    const cleanFields = {};
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
    const emptyResult = items.map(() => ({ en: {}, de: {}, it: {} }));
    return {
      status: 200,
      body: { translations: emptyResult },
    };
  }

  const ai = createGeminiClient();
  if (!ai) {
    return {
      status: 503,
      body: {
        error: 'GEMINI_API_KEY nije podešen na serveru. Provjerite Settings > Secrets ili Vercel Environment Variables.',
      },
    };
  }

  try {
    const response = await generateWithRetry(ai, nonEmpty);
    const rawJson = (response.text ?? '{}').trim();
    const parsed = JSON.parse(rawJson);
    const byIndex = new Map();

    if (Array.isArray(parsed?.translations)) {
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

    const translations = normalized.map((entry) => {
      const keys = Object.keys(entry.fields);
      if (keys.length === 0) return { en: {}, de: {}, it: {} };
      const bucket = byIndex.get(entry.index);
      if (!bucket) {
        throw new Error('Model nije vratio prevod za sve stavke.');
      }
      const filtered = { en: {}, de: {}, it: {} };
      for (const key of keys) {
        if (typeof bucket.en[key] === 'string') filtered.en[key] = bucket.en[key];
        if (typeof bucket.de[key] === 'string') filtered.de[key] = bucket.de[key];
        if (typeof bucket.it[key] === 'string') filtered.it[key] = bucket.it[key];
      }
      return filtered;
    });

    return {
      status: 200,
      body: { translations },
    };
  } catch (error) {
    console.error('[Translate API Error]', error);
    const status = typeof error === 'object' && error !== null && 'status' in error
      ? Number(error.status)
      : 500;
    const message = error instanceof Error ? error.message : 'Prevod putem Gemini API-ja nije uspio.';
    return {
      status: status >= 400 && status < 600 ? status : 500,
      body: { error: message },
    };
  }
}
