import { translateRequestBody } from '../lib/translate.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const result = await translateRequestBody(req.body);
  return res.status(result.status).json(result.body);
}
