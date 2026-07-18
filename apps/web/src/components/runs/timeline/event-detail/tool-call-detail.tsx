import type { EventEnvelope } from "@otomat/domain";

function JsonDisclosure({ label, value }: { label: string; value: unknown }) {
  return (
    <details className="mt-1 max-w-full">
      <summary className="cursor-pointer select-none text-xs text-text-tertiary">{label}</summary>
      <pre className="mt-1 overflow-x-auto rounded-md border border-border-subtle bg-surface-1 px-2.5 py-2 font-mono text-xs leading-relaxed text-text-secondary">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

export function ToolCallDetail({ event }: { event: EventEnvelope }) {
  const args = event.payload["args"];
  const result = event.payload["result"];
  const isError = event.payload["is_error"] === true;
  return (
    <div className="flex flex-col">
      {isError ? <span className="mt-0.5 text-xs text-danger">tool reported an error</span> : null}
      {args !== undefined && args !== null ? <JsonDisclosure label="args" value={args} /> : null}
      {result !== undefined && result !== null ? (
        <JsonDisclosure label="result" value={result} />
      ) : null}
    </div>
  );
}
