import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { generateHandler } from './routes/generate.ts';
import { getGameHandler, listGamesHandler } from './routes/games.ts';
import { getSupabaseAdmin } from './lib/supabase.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Load .env from project root (never commit this file)
dotenv.config({ path: path.join(rootDir, '.env') });

const app = express();
const port = Number(process.env.PORT) || 3001;
const isProd = process.env.NODE_ENV === 'production';

app.use(cors({ origin: isProd ? false : true }));
app.use(express.json({ limit: '12mb' }));

app.get('/api/health', (_req, res) => {
  const provider = (process.env.IMAGE_PROVIDER ?? 'pollinations').trim().toLowerCase();
  res.json({
    ok: true,
    service: 'thebox',
    provider,
    hasPollinationsKey: Boolean(process.env.POLLINATIONS_API_KEY?.trim()),
    hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY?.trim()),
    supabase: Boolean(getSupabaseAdmin()),
  });
});

app.post('/api/generate', generateHandler);
app.get('/api/games', listGamesHandler);
app.get('/api/games/:id', getGameHandler);

if (isProd) {
  const distDir = path.join(rootDir, 'dist');
  app.use(express.static(distDir));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

if (process.env.VITEST !== 'true') {
  app.listen(port, () => {
    console.log(`[thebox] API listening on http://localhost:${port}`);
    const provider = (process.env.IMAGE_PROVIDER ?? 'pollinations').trim().toLowerCase();
    console.log(`[thebox] image provider: ${provider}`);
    if (provider === 'pollinations' && !process.env.POLLINATIONS_API_KEY?.trim()) {
      console.warn('[thebox] WARNING: POLLINATIONS_API_KEY is not set.');
    }
    if (provider === 'openai' && !process.env.OPENAI_API_KEY?.trim()) {
      console.warn('[thebox] WARNING: OPENAI_API_KEY is not set.');
    }
    if (!getSupabaseAdmin()) {
      console.warn(
        '[thebox] WARNING: Supabase not configured — past games will not be logged. Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.',
      );
    } else {
      console.log('[thebox] Supabase game logging enabled');
    }
  });
}

export { app };
