import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchGameDetail,
  fetchPastGames,
  generateBoxImage,
  getOrCreateClientId,
  toDataUrl,
} from '../api/generateBoxImage';
import type { GameSessionSummary } from '@/shared/types';

export function useBoxGeneration() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusLabel, setStatusLabel] = useState('Loading your box…');
  const [pastGames, setPastGames] = useState<GameSessionSummary[]>([]);
  const [gamesError, setGamesError] = useState<string | null>(null);
  const [viewingPast, setViewingPast] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const booted = useRef(false);
  const clientIdRef = useRef(getOrCreateClientId());

  const refreshPastGames = useCallback(async () => {
    try {
      const games = await fetchPastGames();
      setPastGames(games);
      setGamesError(null);
    } catch (err) {
      setGamesError(err instanceof Error ? err.message : 'Could not load past games');
    }
  }, []);

  const runGenerate = useCallback(
    async (mode: 'default' | 'addition', prompt?: string, nextHistory?: string[]) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);
      setError(null);
      setViewingPast(false);
      setStatusLabel(mode === 'default' ? 'Summoning the default box…' : 'Painting your addition…');

      try {
        const result = await generateBoxImage({
          mode,
          prompt,
          history: nextHistory ?? history,
          sessionId: mode === 'default' ? null : sessionId,
          clientId: clientIdRef.current,
          forceNewSession: mode === 'default',
          signal: controller.signal,
        });
        setImageUrl(toDataUrl(result.imageBase64, result.mimeType));
        if (result.sessionId) {
          setSessionId(result.sessionId);
        }
        if (mode === 'default') {
          setHistory([]);
        } else if (prompt?.trim()) {
          setHistory((prev) => [...prev, prompt.trim()]);
        }
        setStatusLabel(mode === 'default' ? 'Default box ready' : 'Scene updated');
        if (result.logWarning) {
          console.warn('Game log warning:', result.logWarning);
        }
        void refreshPastGames();
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        const message = err instanceof Error ? err.message : 'Generation failed.';
        setError(message);
        setStatusLabel('Something went wrong');
      } finally {
        setIsLoading(false);
      }
    },
    [history, sessionId, refreshPastGames],
  );

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    void runGenerate('default');
    void refreshPastGames();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot once
  }, []);

  const submitAddition = useCallback(
    async (prompt: string) => {
      const trimmed = prompt.trim();
      if (!trimmed) {
        setError('Type something to add to the box.');
        return;
      }
      await runGenerate('addition', trimmed, history);
    },
    [history, runGenerate],
  );

  const resetToDefault = useCallback(async () => {
    setHistory([]);
    setSessionId(null);
    await runGenerate('default', undefined, []);
  }, [runGenerate]);

  const openPastGame = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    setStatusLabel('Loading past game…');
    try {
      const detail = await fetchGameDetail(id);
      const last = detail.turns[detail.turns.length - 1];
      if (!last?.image_public_url) {
        throw new Error('This game has no saved images.');
      }
      setImageUrl(last.image_public_url);
      setSessionId(detail.session.id);
      const prompts = detail.turns
        .filter((t) => t.mode === 'addition' && t.prompt)
        .map((t) => t.prompt as string);
      setHistory(prompts);
      setViewingPast(true);
      setStatusLabel(`Viewing: ${detail.session.title}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open game');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    imageUrl,
    history,
    sessionId,
    isLoading,
    error,
    statusLabel,
    pastGames,
    gamesError,
    viewingPast,
    submitAddition,
    resetToDefault,
    openPastGame,
    refreshPastGames,
    clearError: () => setError(null),
  };
}
