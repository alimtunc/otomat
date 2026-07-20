import type { RuntimeDescriptor } from "@otomat/domain";
import {
  Button,
  cn,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@otomat/ui";
import { isAvailableRuntime } from "@web/lib/runtimes";
import type { WorkflowNodeDraft } from "@web/lib/workflow-plan";

const DEFAULT_RUNTIME_VALUE = "__default";

export function StepRuntimeSelect({
  descriptors,
  label,
  value,
  onValueChange,
}: {
  descriptors: RuntimeDescriptor[];
  label: string;
  value: string | null;
  onValueChange: (runtime: string | null) => void;
}) {
  const items = [
    { value: DEFAULT_RUNTIME_VALUE, label: "Run default", disabled: false },
    ...descriptors.map((descriptor) => ({
      value: descriptor.id,
      label: descriptor.display_name,
      disabled: !isAvailableRuntime(descriptor),
    })),
  ];
  return (
    <Select
      items={items}
      value={value ?? DEFAULT_RUNTIME_VALUE}
      onValueChange={(next) => {
        if (next !== null) onValueChange(next === DEFAULT_RUNTIME_VALUE ? null : next);
      }}
    >
      <SelectTrigger aria-label={label} className="h-7 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value} disabled={item.disabled}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function DependencyToggles({
  earlier,
  dependsOn,
  onToggle,
}: {
  earlier: WorkflowNodeDraft[];
  dependsOn: string[];
  onToggle: (key: string) => void;
}) {
  if (earlier.length === 0) {
    return <span className="text-xs text-text-tertiary">Runs first</span>;
  }
  const dependsOnSet = new Set(dependsOn);
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="text-xs text-text-tertiary">After:</span>
      {earlier.map((candidate, candidateIndex) => {
        const pressed = dependsOnSet.has(candidate.key);
        return (
          <Button
            key={candidate.key}
            type="button"
            variant="outline"
            size="xs"
            aria-pressed={pressed}
            className={cn(pressed ? "border-accent text-accent" : "text-text-secondary")}
            onClick={() => onToggle(candidate.key)}
          >
            {candidate.kind === "compete" ? "Winner of " : ""}
            {candidate.name.trim() || `Step ${candidateIndex + 1}`}
          </Button>
        );
      })}
    </div>
  );
}
