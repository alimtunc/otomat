import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
  Icon,
} from "@otomat/ui";
import { ColorDot } from "@web/components/issues/color-dot";

import type { LinearIssueEditing } from "./use-linear-issue-editing";

const LABEL_CHIP_CLASS =
  "inline-flex h-5.5 items-center gap-1.5 rounded-full border border-border-subtle px-2 text-xs text-foreground";

export function LabelsEditor({ editing }: { editing: LinearIssueEditing }) {
  const { values, metadata, snapshot } = editing;
  if (values === null) return null;
  const known = metadata?.labels ?? snapshot?.labels ?? [];
  const selected = values.label_ids
    .map((id) => known.find((label) => label.id === id))
    .filter((label) => label !== undefined);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-text-tertiary">Labels</span>
      <div className="flex flex-wrap items-center gap-1">
        {selected.map((label) => (
          <span key={label.id} className={LABEL_CHIP_CLASS}>
            <ColorDot color={label.color} />
            {label.name}
          </span>
        ))}
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Edit labels"
            disabled={!editing.canEdit || metadata === null}
            className="inline-flex h-5.5 items-center gap-1 rounded-full border border-dashed border-border-subtle px-2 text-xs text-text-tertiary transition-colors duration-100 hover:border-border hover:text-text-secondary disabled:pointer-events-none disabled:opacity-50"
          >
            <Icon name="plus" size="xs" />
            {selected.length === 0 ? "Add label" : null}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {(metadata?.labels ?? []).length === 0 ? (
              <div className="px-2 py-1.5 text-xs text-text-tertiary">No labels on this team.</div>
            ) : (
              (metadata?.labels ?? []).map((label) => {
                const active = values.label_ids.includes(label.id);
                return (
                  <DropdownMenuCheckboxItem
                    key={label.id}
                    checked={active}
                    closeOnClick={false}
                    onCheckedChange={() =>
                      editing.updateFields({
                        label_ids: active
                          ? values.label_ids.filter((id) => id !== label.id)
                          : [...values.label_ids, label.id],
                      })
                    }
                  >
                    <span className="inline-flex items-center gap-2">
                      <ColorDot color={label.color} />
                      {label.name}
                    </span>
                  </DropdownMenuCheckboxItem>
                );
              })
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
