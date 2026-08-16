import { resolveStatus, type KindStatusMap, type StatusKind } from "../lib/status";
import { TONE_TEXT } from "../lib/tone";
import { cn } from "../lib/utils";

export interface StatusGlyphProps<K extends StatusKind = StatusKind> {
  kind: K;
  status: KindStatusMap[K];
  className?: string;
}

export function StatusGlyph<K extends StatusKind>({
  kind,
  status,
  className,
}: StatusGlyphProps<K>) {
  const { tone, icon: Icon } = resolveStatus(kind, status);

  return <Icon aria-hidden className={cn("size-3.5 shrink-0", TONE_TEXT[tone], className)} />;
}
