import type { SupabaseClient } from '@supabase/supabase-js';
import type { GenerateMode } from '../../src/shared/types.ts';

export type LogTurnInput = {
  sessionId?: string | null;
  clientId?: string | null;
  mode: GenerateMode;
  prompt?: string;
  history: string[];
  imageBase64: string;
  mimeType: string;
  revisedPrompt: string;
};

export type LogTurnResult = {
  sessionId: string;
  turnId: string;
  turnIndex: number;
  imagePublicUrl: string | null;
  imagePath: string | null;
};

function extensionForMime(mimeType: string): string {
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
  if (mimeType.includes('webp')) return 'webp';
  return 'png';
}

function titleFromPrompt(mode: GenerateMode, prompt?: string, history: string[] = []): string {
  if (mode === 'addition' && prompt?.trim()) {
    const t = prompt.trim();
    return t.length > 48 ? `${t.slice(0, 45)}…` : t;
  }
  if (history.length > 0) {
    const last = history[history.length - 1]!;
    return last.length > 48 ? `${last.slice(0, 45)}…` : last;
  }
  return 'Plain box';
}

/**
 * Persist a game turn: ensure session, upload image, insert row.
 * Pure DB/storage I/O — injectable client for tests.
 */
export async function logGameTurn(
  supabase: SupabaseClient,
  input: LogTurnInput,
): Promise<LogTurnResult> {
  let sessionId = input.sessionId?.trim() || null;

  if (sessionId) {
    const { data: existing, error } = await supabase
      .from('game_sessions')
      .select('id')
      .eq('id', sessionId)
      .maybeSingle();
    if (error) throw new Error(`Failed to load session: ${error.message}`);
    if (!existing) sessionId = null;
  }

  if (!sessionId) {
    const title = titleFromPrompt(input.mode, input.prompt, input.history);
    const { data: created, error } = await supabase
      .from('game_sessions')
      .insert({
        client_id: input.clientId ?? null,
        title,
      })
      .select('id')
      .single();
    if (error || !created) {
      throw new Error(`Failed to create session: ${error?.message ?? 'unknown'}`);
    }
    sessionId = created.id as string;
  } else if (input.mode === 'addition' && input.prompt?.trim()) {
    // Keep session title fresh with latest addition
    await supabase
      .from('game_sessions')
      .update({ title: titleFromPrompt(input.mode, input.prompt, input.history) })
      .eq('id', sessionId);
  }

  const { count, error: countError } = await supabase
    .from('game_turns')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', sessionId);

  if (countError) throw new Error(`Failed to count turns: ${countError.message}`);
  const turnIndex = count ?? 0;

  const ext = extensionForMime(input.mimeType);
  const imagePath = `${sessionId}/${turnIndex}.${ext}`;
  const bytes = Buffer.from(input.imageBase64, 'base64');

  const { error: uploadError } = await supabase.storage
    .from('box-images')
    .upload(imagePath, bytes, {
      contentType: input.mimeType || 'image/png',
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Failed to upload image: ${uploadError.message}`);
  }

  const { data: publicData } = supabase.storage.from('box-images').getPublicUrl(imagePath);
  const imagePublicUrl = publicData?.publicUrl ?? null;

  const historyForRow =
    input.mode === 'addition' && input.prompt?.trim()
      ? [...input.history, input.prompt.trim()]
      : input.history;

  const { data: turn, error: turnError } = await supabase
    .from('game_turns')
    .insert({
      session_id: sessionId,
      turn_index: turnIndex,
      mode: input.mode,
      prompt: input.prompt ?? null,
      history: historyForRow,
      image_path: imagePath,
      image_public_url: imagePublicUrl,
      revised_prompt: input.revisedPrompt,
    })
    .select('id')
    .single();

  if (turnError || !turn) {
    throw new Error(`Failed to insert turn: ${turnError?.message ?? 'unknown'}`);
  }

  return {
    sessionId,
    turnId: turn.id as string,
    turnIndex,
    imagePublicUrl,
    imagePath,
  };
}

export async function listGameSessions(
  supabase: SupabaseClient,
  limit = 30,
): Promise<
  Array<{
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
    turn_count: number;
    latest_image_url: string | null;
  }>
> {
  const { data: sessions, error } = await supabase
    .from('game_sessions')
    .select('id, title, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to list sessions: ${error.message}`);
  if (!sessions?.length) return [];

  const ids = sessions.map((s) => s.id as string);
  const { data: turns, error: turnsError } = await supabase
    .from('game_turns')
    .select('session_id, turn_index, image_public_url')
    .in('session_id', ids)
    .order('turn_index', { ascending: false });

  if (turnsError) throw new Error(`Failed to list turns: ${turnsError.message}`);

  const latestBySession = new Map<string, string | null>();
  const countBySession = new Map<string, number>();
  for (const t of turns ?? []) {
    const sid = t.session_id as string;
    countBySession.set(sid, (countBySession.get(sid) ?? 0) + 1);
    if (!latestBySession.has(sid)) {
      latestBySession.set(sid, (t.image_public_url as string | null) ?? null);
    }
  }

  return sessions.map((s) => ({
    id: s.id as string,
    title: s.title as string,
    created_at: s.created_at as string,
    updated_at: s.updated_at as string,
    turn_count: countBySession.get(s.id as string) ?? 0,
    latest_image_url: latestBySession.get(s.id as string) ?? null,
  }));
}

export async function getGameSession(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<{
  session: { id: string; title: string; created_at: string; updated_at: string };
  turns: Array<{
    id: string;
    turn_index: number;
    mode: string;
    prompt: string | null;
    history: string[];
    image_public_url: string | null;
    revised_prompt: string | null;
    created_at: string;
  }>;
} | null> {
  const { data: session, error } = await supabase
    .from('game_sessions')
    .select('id, title, created_at, updated_at')
    .eq('id', sessionId)
    .maybeSingle();

  if (error) throw new Error(`Failed to get session: ${error.message}`);
  if (!session) return null;

  const { data: turns, error: turnsError } = await supabase
    .from('game_turns')
    .select('id, turn_index, mode, prompt, history, image_public_url, revised_prompt, created_at')
    .eq('session_id', sessionId)
    .order('turn_index', { ascending: true });

  if (turnsError) throw new Error(`Failed to get turns: ${turnsError.message}`);

  return {
    session: {
      id: session.id as string,
      title: session.title as string,
      created_at: session.created_at as string,
      updated_at: session.updated_at as string,
    },
    turns: (turns ?? []).map((t) => ({
      id: t.id as string,
      turn_index: t.turn_index as number,
      mode: t.mode as string,
      prompt: (t.prompt as string | null) ?? null,
      history: Array.isArray(t.history) ? (t.history as string[]) : [],
      image_public_url: (t.image_public_url as string | null) ?? null,
      revised_prompt: (t.revised_prompt as string | null) ?? null,
      created_at: t.created_at as string,
    })),
  };
}
