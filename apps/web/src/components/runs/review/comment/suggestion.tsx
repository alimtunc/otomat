export interface CommentSuggestionProps {
  original: string | null;
  replacement: string;
}

export function CommentSuggestion({ original, replacement }: CommentSuggestionProps) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-text-tertiary">Suggested change</p>
      <pre className="overflow-x-auto rounded-sm border border-border-subtle bg-surface-1 font-mono text-xs">
        {original === null ? null : (
          <code className="block bg-danger-bg px-2 py-1 text-text-secondary">{original}</code>
        )}
        <code className="block bg-success-bg px-2 py-1 text-foreground">{replacement}</code>
      </pre>
    </div>
  );
}
