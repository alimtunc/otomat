import { ProviderMark, type ProviderMarkName } from "@otomat/ui";

/** One option row: the provider's mark, then its name. A runtime with no mark keeps the column aligned. */
export function ProviderOptionRow({
  mark,
  label,
}: {
  mark: ProviderMarkName | null;
  label: string;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      {mark ? <ProviderMark name={mark} /> : <span className="size-3.5 shrink-0" />}
      <span className="truncate">{label}</span>
    </span>
  );
}
