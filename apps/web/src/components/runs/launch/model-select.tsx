import type { ModelSelection } from "@otomat/domain";
import {
  Button,
  cn,
  Icon,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@otomat/ui";
import { useRuntimeModels } from "@web/api/daemon/queries";
import {
  catalogNote,
  isCompleteModelSelection,
  MODEL_CUSTOM_VALUE,
  modelChoiceItems,
  modelSelectionFromValue,
  modelSelectValue,
} from "@web/lib/model-choice";
import { useState } from "react";

export interface ModelSelectProps {
  /** Null while no runtime is chosen: nothing can be listed yet. */
  runtimeId: string | null;
  /** Undefined means "inherit"; only offered when `inheritLabel` is set. */
  value: ModelSelection | undefined;
  onValueChange: (value: ModelSelection | undefined) => void;
  inheritLabel?: string;
  ariaLabel?: string;
  /** Shrinks the controls for dense per-step rows; every choice stays available. */
  compact?: boolean;
}

function CatalogNote({ note }: { note: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            aria-label="Where these models come from"
            className="size-5 shrink-0 p-0 text-text-tertiary"
          >
            <Icon name="info" aria-hidden />
          </Button>
        }
      />
      <TooltipContent className="max-w-64 whitespace-normal">{note}</TooltipContent>
    </Tooltip>
  );
}

export function ModelSelect({
  runtimeId,
  value,
  onValueChange,
  inheritLabel,
  ariaLabel = "Model",
  compact = false,
}: ModelSelectProps) {
  const catalog = useRuntimeModels(runtimeId);
  const [customMode, setCustomMode] = useState(false);
  const listedValue = modelSelectValue(value, catalog.data);
  const isCustom = customMode ? value?.kind === "model" : listedValue === MODEL_CUSTOM_VALUE;
  const selected = isCustom ? MODEL_CUSTOM_VALUE : listedValue;
  const items = modelChoiceItems(catalog.data, { inheritLabel, selected });
  const customId = value?.kind === "model" ? value.id : "";
  const note = catalogNote(catalog.data, runtimeId !== null && catalog.isPending, catalog.isError);

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <Select
        items={items}
        value={selected}
        onValueChange={(next) => {
          if (next === null) return;
          setCustomMode(next === MODEL_CUSTOM_VALUE);
          onValueChange(modelSelectionFromValue(next, value));
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
      {isCustom ? (
        <Input
          value={customId}
          aria-label="Custom model identifier"
          placeholder="Model identifier the provider accepts"
          invalid={!isCompleteModelSelection(value)}
          className={cn("w-auto min-w-0", compact && "h-7 text-xs")}
          onChange={(event) => {
            setCustomMode(true);
            onValueChange({ kind: "model", id: event.target.value });
          }}
        />
      ) : null}
      {note === null ? null : <CatalogNote note={note} />}
      {catalog.isError ? (
        <Button variant="ghost" size="xs" onClick={() => void catalog.refetch()}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}
