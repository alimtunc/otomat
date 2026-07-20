export function JsonDisclosure({ label, value }: { label: string; value: unknown }) {
  return (
    <details className="mt-1 max-w-full">
      <summary className="cursor-pointer select-none text-xs text-text-tertiary">{label}</summary>
      <pre className="mt-1 overflow-x-auto rounded-md border border-border-subtle bg-surface-1 px-2.5 py-2 font-mono text-xs leading-relaxed text-text-secondary">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}
