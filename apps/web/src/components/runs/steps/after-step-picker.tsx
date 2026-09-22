import type { WaitablePlanNode } from "@otomat/domain";
import {
  FieldControl,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@otomat/ui";

export interface AfterStepPickerProps {
  candidates: readonly WaitablePlanNode[];
  after: WaitablePlanNode | null;
  onChange: (nodeId: string) => void;
}

export function AfterStepPicker({ candidates, after, onChange }: AfterStepPickerProps) {
  if (after === null) {
    return (
      <p className="text-xs text-text-tertiary">
        No step left to wait on — starts as soon as the workspace is free.
      </p>
    );
  }
  const items = candidates.map(({ node }) => ({ value: node.id, label: node.name }));
  return (
    <>
      <Select
        items={items}
        value={after.node.id}
        onValueChange={(next) => {
          if (next !== null) onChange(next);
        }}
      >
        <FieldControl>
          <SelectTrigger aria-label="Step to wait on">
            <SelectValue />
          </SelectTrigger>
        </FieldControl>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-text-tertiary">
        {after.succeeded
          ? `${after.node.name} already succeeded — eligible now, starts as soon as the workspace is free.`
          : `Queued until ${after.node.name} succeeds.`}
      </p>
    </>
  );
}
