import { effortOptionDescriptor, type EffortSelection } from "@otomat/domain";
import {
  Button,
  cn,
  Icon,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@otomat/ui";
import { useRuntimeProviderOptions } from "@web/api/daemon/queries";
import {
  effortChoiceItems,
  effortNote,
  effortSelectionFromValue,
  effortSelectValue,
  resolvedEffortLabel,
  type ResolvedEffort,
} from "@web/lib/effort-choice";

export interface EffortSelectProps {
  /** Null while no runtime is chosen: nothing can be detected yet. */
  runtimeId: string | null;
  /** The model the levels are scoped to; Codex publishes its reasoning levels per model. */
  modelId: string | null;
  /** Undefined inherits the run's; that entry is offered only when `offerRun` is set. */
  value: EffortSelection | undefined;
  onValueChange: (value: EffortSelection | undefined) => void;
  /** Whether "Same as run" is one of the entries; the run-level picker has no run to inherit from. */
  offerRun?: boolean;
  /** What this selection resolves to right now, shown beside the picker so the effective level is never hidden. */
  resolved: ResolvedEffort;
  ariaLabel: string;
  /** Shrinks the control for dense per-step rows; every choice stays available. */
  compact?: boolean;
}

/**
 * Every level comes from the descriptor the daemon feature-detected for this
 * runtime and model, so a CLI that announces none offers only the two inherit
 * entries. A selected level the current pair dropped stays visible, marked, and
 * the daemon refuses it at launch rather than this surface rewriting it.
 */
export function EffortSelect({
  runtimeId,
  modelId,
  value,
  onValueChange,
  offerRun = false,
  resolved,
  ariaLabel,
  compact = false,
}: EffortSelectProps) {
  const detected = useRuntimeProviderOptions(runtimeId, modelId);
  const descriptor = effortOptionDescriptor(detected.data?.options ?? []);
  // Before the daemon answers, a level it has not listed yet is not a level it dropped.
  const items = effortChoiceItems(descriptor, value, {
    offerRun,
    answered: detected.data !== undefined,
  });
  const selected = effortSelectValue(value);
  const stale = items.some((item) => item.value === selected && item.stale);
  const note = effortNote(
    detected.data,
    descriptor,
    runtimeId !== null && detected.isPending,
    detected.isError,
  );

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <Select
        items={items}
        value={selected}
        onValueChange={(next) => {
          if (next === null) return;
          onValueChange(effortSelectionFromValue(next));
        }}
      >
        <SelectTrigger
          aria-label={ariaLabel}
          disabled={runtimeId === null}
          className={cn("min-w-0 flex-1 basis-40", compact && "h-7 text-xs")}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className={cn("text-xs text-text-tertiary", compact && "text-[11px]")}>
        {`Effective: ${resolvedEffortLabel(resolved, descriptor)}`}
      </span>
      {stale ? (
        <p role="alert" className="text-xs text-danger">
          {`This runtime and model no longer announce “${selected}”. Pick another level — a launch with it is refused.`}
        </p>
      ) : null}
      {note === null ? null : (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                aria-label="Where these effort levels come from"
                className="size-5 shrink-0 p-0 text-text-tertiary"
              >
                <Icon name="info" aria-hidden />
              </Button>
            }
          />
          <TooltipContent className="max-w-64 whitespace-normal">{note}</TooltipContent>
        </Tooltip>
      )}
      {detected.isError ? (
        <Button variant="ghost" size="xs" onClick={() => void detected.refetch()}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}
