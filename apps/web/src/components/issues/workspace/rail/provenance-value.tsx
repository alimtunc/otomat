import { FOCUS_RING, Tooltip, TooltipContent, TooltipTrigger } from "@otomat/ui";
import { Mono } from "@web/components/issues/workspace/rail/mono";

export interface ProvenanceValueProps {
  value: string;
  source: string | null;
}

/** Focusable on purpose: the provenance has to reach a keyboard user, not only a pointer. */
export function ProvenanceValue({ value, source }: ProvenanceValueProps) {
  if (source === null) return <Mono>{value}</Mono>;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            tabIndex={0}
            aria-label={`${value} — ${source}`}
            className={`min-w-0 rounded-sm ${FOCUS_RING}`}
          />
        }
      >
        <Mono className="border-b border-dashed border-border">{value}</Mono>
      </TooltipTrigger>
      <TooltipContent className="max-w-64 whitespace-normal">{source}</TooltipContent>
    </Tooltip>
  );
}
