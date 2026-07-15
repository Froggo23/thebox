type Props = {
  imageUrl: string | null;
  isLoading: boolean;
  statusLabel: string;
};

export function BoxScene({ imageUrl, isLoading, statusLabel }: Props) {
  return (
    <section className="scene" aria-label="The box scene">
      <div className={`scene-frame ${isLoading ? 'is-loading' : ''}`}>
        {imageUrl ? (
          <img
            className="scene-image"
            src={imageUrl}
            alt="AI-generated photograph of a box, possibly with your additions"
          />
        ) : (
          <div className="scene-placeholder" role="status">
            <div className="pulse-box" aria-hidden="true" />
            <p>{statusLabel}</p>
          </div>
        )}
        {isLoading && imageUrl && (
          <div className="scene-overlay" role="status" aria-live="polite">
            <span className="spinner" aria-hidden="true" />
            <span>{statusLabel}</span>
          </div>
        )}
      </div>
    </section>
  );
}
