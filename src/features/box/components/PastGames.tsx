import type { GameSessionSummary } from '@/shared/types';

type Props = {
  games: GameSessionSummary[];
  error: string | null;
  activeSessionId: string | null;
  disabled?: boolean;
  onSelect: (id: string) => void;
  onRefresh: () => void;
};

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function PastGames({
  games,
  error,
  activeSessionId,
  disabled,
  onSelect,
  onRefresh,
}: Props) {
  return (
    <section className="past-games" aria-labelledby="past-games-heading">
      <div className="past-games-header">
        <h2 id="past-games-heading">Past games</h2>
        <button type="button" className="btn ghost" onClick={onRefresh} disabled={disabled}>
          Refresh
        </button>
      </div>

      {error && <p className="past-games-error">{error}</p>}

      {!error && games.length === 0 && (
        <p className="history-empty">No logged games yet. Transform the box once to start a log.</p>
      )}

      <ul className="past-games-list">
        {games.map((g) => (
          <li key={g.id}>
            <button
              type="button"
              className={`past-game-card ${activeSessionId === g.id ? 'is-active' : ''}`}
              onClick={() => onSelect(g.id)}
              disabled={disabled}
            >
              <div className="past-game-thumb-wrap">
                {g.latest_image_url ? (
                  <img className="past-game-thumb" src={g.latest_image_url} alt="" />
                ) : (
                  <div className="past-game-thumb placeholder" />
                )}
              </div>
              <div className="past-game-meta">
                <span className="past-game-title">{g.title}</span>
                <span className="past-game-sub">
                  {g.turn_count} turn{g.turn_count === 1 ? '' : 's'} · {formatWhen(g.updated_at)}
                </span>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
