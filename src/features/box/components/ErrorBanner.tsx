type Props = {
  message: string | null;
  onDismiss?: () => void;
};

export function ErrorBanner({ message, onDismiss }: Props) {
  if (!message) return null;

  return (
    <div className="error-banner" role="alert">
      <p>{message}</p>
      {onDismiss && (
        <button type="button" className="btn ghost" onClick={onDismiss}>
          Dismiss
        </button>
      )}
    </div>
  );
}
