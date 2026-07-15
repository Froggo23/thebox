import { BoxScene } from '@/features/box/components/BoxScene';
import { ErrorBanner } from '@/features/box/components/ErrorBanner';
import { HistoryChips } from '@/features/box/components/HistoryChips';
import { PastGames } from '@/features/box/components/PastGames';
import { PromptForm } from '@/features/box/components/PromptForm';
import { useBoxGeneration } from '@/features/box/hooks/useBoxGeneration';

export function App() {
  const {
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
    clearError,
  } = useBoxGeneration();

  return (
    <div className="app-shell">
      <div className="glow glow-a" aria-hidden="true" />
      <div className="glow glow-b" aria-hidden="true" />

      <header className="hero">
        <p className="eyebrow">Revived · AI photo + Supabase logs</p>
        <h1>The Box</h1>
        <p className="lede">
          Type what you want added to the box. Each prompt paints a new{' '}
          <strong>AI-generated photo</strong>. Finished scenes are logged so you can replay past
          games.
        </p>
        {viewingPast && (
          <p className="viewing-badge" role="status">
            Viewing a past game — hit <strong>Reset to plain box</strong> to play again.
          </p>
        )}
      </header>

      <main className="layout layout-three">
        <BoxScene imageUrl={imageUrl} isLoading={isLoading} statusLabel={statusLabel} />

        <aside className="controls">
          <ErrorBanner message={error} onDismiss={clearError} />

          <PromptForm disabled={isLoading || viewingPast} onSubmit={submitAddition} />

          <div className="control-row">
            <button
              type="button"
              className="btn secondary"
              onClick={() => void resetToDefault()}
              disabled={isLoading}
            >
              Reset to plain box
            </button>
          </div>

          <section className="history-panel" aria-labelledby="history-heading">
            <h2 id="history-heading">Scene history</h2>
            <HistoryChips history={history} />
          </section>

          <p className="footnote">
            Images via <strong>Pollinations</strong> (server-side). Game logs + files live on{' '}
            <strong>Supabase</strong>.
          </p>
        </aside>

        <PastGames
          games={pastGames}
          error={gamesError}
          activeSessionId={sessionId}
          disabled={isLoading}
          onSelect={(id) => void openPastGame(id)}
          onRefresh={() => void refreshPastGames()}
        />
      </main>
    </div>
  );
}
