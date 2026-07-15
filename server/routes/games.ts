import type { Request, Response } from 'express';
import { getSupabaseAdmin } from '../lib/supabase.ts';
import { getGameSession, listGameSessions } from '../lib/gameLog.ts';

export async function listGamesHandler(_req: Request, res: Response): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      res.status(503).json({
        error: 'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
        games: [],
      });
      return;
    }
    const games = await listGameSessions(supabase, 40);
    res.status(200).json({ games });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list games';
    res.status(500).json({ error: message, games: [] });
  }
}

export async function getGameHandler(req: Request, res: Response): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      res.status(503).json({ error: 'Supabase is not configured.' });
      return;
    }
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Missing session id' });
      return;
    }
    const detail = await getGameSession(supabase, id);
    if (!detail) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }
    res.status(200).json(detail);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load game';
    res.status(500).json({ error: message });
  }
}
