import { describe, expect, it, vi } from 'vitest';
import { logGameTurn, listGameSessions, getGameSession } from '../server/lib/gameLog';

function mockSupabase(handlers: {
  existingSession?: { id: string } | null;
  insertSessionId?: string;
  turnCount?: number;
  insertTurnId?: string;
  sessions?: Array<Record<string, unknown>>;
  turns?: Array<Record<string, unknown>>;
}) {
  const upload = vi.fn().mockResolvedValue({ error: null });
  const getPublicUrl = vi.fn().mockReturnValue({
    data: { publicUrl: 'http://localhost/storage/v1/object/public/box-images/s/0.png' },
  });

  const from = vi.fn((table: string) => {
    if (table === 'game_sessions') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: handlers.existingSession ?? null,
              error: null,
            }),
          }),
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: handlers.sessions ?? [],
              error: null,
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: handlers.insertSessionId ?? 'sess-new' },
              error: null,
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      };
    }
    if (table === 'game_turns') {
      return {
        select: vi.fn((_cols?: string, opts?: { count?: string; head?: boolean }) => {
          if (opts?.head) {
            return {
              eq: vi.fn().mockResolvedValue({
                count: handlers.turnCount ?? 0,
                error: null,
              }),
            };
          }
          // chain for list/get
          const chain: Record<string, unknown> = {};
          chain.eq = vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: handlers.turns ?? [],
              error: null,
            }),
          });
          chain.in = vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: handlers.turns ?? [],
              error: null,
            }),
          });
          chain.order = vi.fn().mockResolvedValue({
            data: handlers.turns ?? [],
            error: null,
          });
          return chain;
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: handlers.insertTurnId ?? 'turn-1' },
              error: null,
            }),
          }),
        }),
      };
    }
    throw new Error(`unexpected table ${table}`);
  });

  return {
    from,
    storage: {
      from: vi.fn(() => ({ upload, getPublicUrl })),
    },
    _upload: upload,
  };
}

describe('logGameTurn', () => {
  it('creates a session, uploads image, and inserts turn 0', async () => {
    const sb = mockSupabase({
      existingSession: null,
      insertSessionId: 'sess-1',
      turnCount: 0,
      insertTurnId: 'turn-0',
    });

    const result = await logGameTurn(sb as never, {
      mode: 'default',
      history: [],
      imageBase64: Buffer.from('fake').toString('base64'),
      mimeType: 'image/png',
      revisedPrompt: 'a box',
      clientId: 'client-a',
    });

    expect(result.sessionId).toBe('sess-1');
    expect(result.turnId).toBe('turn-0');
    expect(result.turnIndex).toBe(0);
    expect(result.imagePublicUrl).toContain('box-images');
    expect(sb._upload).toHaveBeenCalled();
  });

  it('appends turn to existing session', async () => {
    const sb = mockSupabase({
      existingSession: { id: 'sess-9' },
      turnCount: 2,
      insertTurnId: 'turn-2',
    });

    const result = await logGameTurn(sb as never, {
      sessionId: 'sess-9',
      mode: 'addition',
      prompt: 'add a hat',
      history: ['sunglasses'],
      imageBase64: 'abc',
      mimeType: 'image/png',
      revisedPrompt: 'box hat',
    });

    expect(result.sessionId).toBe('sess-9');
    expect(result.turnIndex).toBe(2);
  });
});

describe('listGameSessions / getGameSession', () => {
  it('lists sessions with counts and latest image', async () => {
    const sb = mockSupabase({
      sessions: [
        {
          id: 's1',
          title: 'hat',
          created_at: '2026-01-01',
          updated_at: '2026-01-02',
        },
      ],
      turns: [
        { session_id: 's1', turn_index: 1, image_public_url: 'http://img/1.png' },
        { session_id: 's1', turn_index: 0, image_public_url: 'http://img/0.png' },
      ],
    });

    const list = await listGameSessions(sb as never, 10);
    expect(list).toHaveLength(1);
    expect(list[0]!.turn_count).toBe(2);
    expect(list[0]!.latest_image_url).toBe('http://img/1.png');
  });

  it('returns null for missing session', async () => {
    // getGameSession uses maybeSingle on game_sessions with different chain
    const from = vi.fn((table: string) => {
      if (table === 'game_sessions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }
      return {};
    });
    const result = await getGameSession({ from } as never, 'missing');
    expect(result).toBeNull();
  });
});
