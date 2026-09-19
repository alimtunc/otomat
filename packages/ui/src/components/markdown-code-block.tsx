import { parseQrModules } from "../lib/markdown";
import { CopyButton } from "./copy-button";
import { QrCode } from "./qr-code";

export interface MarkdownCodeBlockProps {
  language: string | null;
  value: string;
  closed: boolean;
}

/** Long lines scroll inside the block instead of widening the message that holds it,
    and the exact source stays one click away. */
export function MarkdownCodeBlock({ language, value, closed }: MarkdownCodeBlockProps) {
  const modules = parseQrModules(value);
  const label = modules ? "qr code" : (language ?? "code");
  return (
    <div className="overflow-hidden rounded-md border border-border-subtle bg-surface-2">
      <div className="flex items-center gap-2 border-b border-border-subtle px-2.5 py-1">
        <span className="mono text-micro lowercase text-text-tertiary">{label}</span>
        {closed ? null : <span className="text-micro text-text-tertiary">streaming…</span>}
        <span className="flex-1" />
        <CopyButton value={value} label="Copy code" />
      </div>
      {modules ? (
        <div className="px-3 py-2.5">
          <QrCode modules={modules} />
        </div>
      ) : (
        <pre
          tabIndex={0}
          aria-label={`${label} block`}
          className="mono max-h-96 overflow-auto px-3 py-2.5 text-xs leading-[1.6] text-foreground"
        >
          <code>{value}</code>
        </pre>
      )}
    </div>
  );
}
