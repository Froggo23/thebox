type Props = {
  history: string[];
};

export function HistoryChips({ history }: Props) {
  if (history.length === 0) {
    return (
      <p className="history-empty">
        No additions yet — start with something like <em>add a party hat</em>.
      </p>
    );
  }

  return (
    <ul className="history-list" aria-label="Additions so far">
      {history.map((item, index) => (
        <li key={`${index}-${item}`} className="history-chip">
          <span className="history-index">{index + 1}</span>
          {item}
        </li>
      ))}
    </ul>
  );
}
