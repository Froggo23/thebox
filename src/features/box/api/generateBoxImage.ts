import type {
  GenerateMode,
  GenerateResponse,
  GenerateSuccessResponse,
  GameSessionDetail,
  GameSessionSummary,
} from '@/shared/types';

export async function generateBoxImage(options: {
  mode: GenerateMode;
  prompt?: string;
  history?: string[];
  sessionId?: string | null;
  clientId?: string | null;
  forceNewSession?: boolean;
  signal?: AbortSignal;
}): Promise<GenerateSuccessResponse> {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: options.mode,
      prompt: options.prompt,
      history: options.history ?? [],
      sessionId: options.sessionId ?? null,
      clientId: options.clientId ?? null,
      forceNewSession: options.forceNewSession,
    }),
    signal: options.signal,
  });

  const data = (await res.json()) as GenerateResponse;

  if (!res.ok || 'error' in data) {
    const message = 'error' in data ? data.error : `Request failed (${res.status})`;
    throw new Error(message);
  }

  if (!data.imageBase64) {
    throw new Error('Server returned an empty image payload.');
  }

  return data;
}

export function toDataUrl(imageBase64: string, mimeType = 'image/png'): string {
  return `data:${mimeType};base64,${imageBase64}`;
}

export async function fetchPastGames(signal?: AbortSignal): Promise<GameSessionSummary[]> {
  const res = await fetch('/api/games', { signal });
  const data = (await res.json()) as { games?: GameSessionSummary[]; error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? `Failed to load games (${res.status})`);
  }
  return data.games ?? [];
}

export async function fetchGameDetail(
  id: string,
  signal?: AbortSignal,
): Promise<GameSessionDetail> {
  const res = await fetch(`/api/games/${encodeURIComponent(id)}`, { signal });
  const data = (await res.json()) as GameSessionDetail & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? `Failed to load game (${res.status})`);
  }
  return data;
}

const CLIENT_ID_KEY = 'thebox_client_id';

export function getOrCreateClientId(): string {
  try {
    const existing = localStorage.getItem(CLIENT_ID_KEY);
    if (existing) return existing;
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `client_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(CLIENT_ID_KEY, id);
    return id;
  } catch {
    return `anon_${Date.now()}`;
  }
}
