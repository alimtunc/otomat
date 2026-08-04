export function HostTag({ tag }: { tag: string }) {
  return (
    <span className="flex-none rounded border border-border-subtle bg-surface-2 px-1 py-px font-mono text-[10px] leading-4 text-text-tertiary">
      {tag}
    </span>
  );
}
