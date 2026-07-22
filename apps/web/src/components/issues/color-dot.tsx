export function ColorDot({ color }: { color: string | null }) {
  return (
    <span
      aria-hidden
      className="size-2 shrink-0 rounded-full"
      style={{ backgroundColor: color ?? "var(--text-tertiary)" }}
    />
  );
}
