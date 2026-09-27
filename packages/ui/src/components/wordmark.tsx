export interface WordmarkProps {
  enter?: boolean;
}

export function Wordmark({ enter = false }: WordmarkProps) {
  return (
    <span
      role="img"
      aria-label="Otomat"
      data-enter={enter || undefined}
      className="otomat-wordmark"
    >
      <span className="otomat-mark" aria-hidden="true" />
      <span className="otomat-letter" aria-hidden="true">
        t
      </span>
      <span className="otomat-mark" aria-hidden="true" />
      <span className="otomat-letter" aria-hidden="true">
        mat
      </span>
    </span>
  );
}
