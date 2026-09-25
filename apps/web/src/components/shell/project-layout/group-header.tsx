import { Field, FieldControl, Icon, IconButton, Input } from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import type { ProjectGroup } from "@web/components/shell/project-layout/layout";
import {
  MoveButtons,
  type MoveButtonsProps,
} from "@web/components/shell/project-layout/move-buttons";
import { fieldErrorProps, requiredTrimmed } from "@web/lib/form";

export interface GroupHeaderProps {
  group: ProjectGroup;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onRename: (name: string) => void;
  onMove: MoveButtonsProps["onMove"];
  onRemove: () => void;
}

export function GroupHeader({
  group,
  canMoveUp,
  canMoveDown,
  onRename,
  onMove,
  onRemove,
}: GroupHeaderProps) {
  const form = useForm({
    defaultValues: { name: group.name },
    onSubmit: ({ value, formApi }) => {
      const name = value.name.trim();
      if (name !== group.name) onRename(name);
      formApi.reset({ name });
    },
  });

  return (
    <div className="flex items-start gap-1">
      <form
        className="min-w-0 flex-1"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <form.Field name="name" validators={{ onChange: requiredTrimmed("Name the group.") }}>
          {(field) => (
            <Field {...fieldErrorProps(field.state.meta)}>
              <FieldControl>
                <Input
                  value={field.state.value}
                  onBlur={() => {
                    field.handleBlur();
                    void form.handleSubmit();
                  }}
                  onChange={(event) => field.handleChange(event.target.value)}
                  aria-label={`Name of group ${group.name}`}
                  className="h-7 font-medium"
                />
              </FieldControl>
            </Field>
          )}
        </form.Field>
      </form>
      <MoveButtons
        label={`group ${group.name}`}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        onMove={onMove}
      />
      <IconButton
        type="button"
        size="sm"
        label={`Delete group ${group.name}`}
        icon={<Icon name="trash-2" aria-hidden />}
        onClick={onRemove}
      />
    </div>
  );
}
