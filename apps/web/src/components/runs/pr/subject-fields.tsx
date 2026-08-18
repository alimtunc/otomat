import { COMMIT_TYPES, commitScopeViolation, commitSummaryViolation } from "@otomat/domain";
import {
  Field,
  FieldControl,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@otomat/ui";
import type { PullRequestFormApi } from "@web/components/runs/pr/use-form";
import { fieldErrorProps } from "@web/lib/form";

export interface PullRequestSubjectFieldsProps {
  form: PullRequestFormApi;
  disabled: boolean;
}

const TYPE_ITEMS = COMMIT_TYPES.map((type) => ({ value: type, label: type }));

export function PullRequestSubjectFields({ form, disabled }: PullRequestSubjectFieldsProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-3">
        <form.Field name="type">
          {(field) => (
            <Field className="w-36 shrink-0">
              <FieldLabel>Type</FieldLabel>
              <Select
                items={TYPE_ITEMS}
                value={field.state.value}
                disabled={disabled}
                onValueChange={(next) => {
                  if (next !== null) field.handleChange(next);
                }}
              >
                <FieldControl>
                  <SelectTrigger aria-label="Commit type">
                    <SelectValue />
                  </SelectTrigger>
                </FieldControl>
                <SelectContent>
                  {TYPE_ITEMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        </form.Field>
        <form.Field
          name="scope"
          validators={{ onChange: ({ value }) => commitScopeViolation(value.trim()) ?? undefined }}
        >
          {(field) => (
            <Field className="min-w-0 flex-1" {...fieldErrorProps(field.state.meta)}>
              <FieldLabel>Scope</FieldLabel>
              <FieldControl>
                <Input
                  value={field.state.value}
                  disabled={disabled}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="Optional, e.g. publication"
                  spellCheck={false}
                />
              </FieldControl>
            </Field>
          )}
        </form.Field>
      </div>
      <form.Field
        name="summary"
        validators={{
          onChangeListenTo: ["type", "scope"],
          onChange: ({ value, fieldApi }) =>
            commitSummaryViolation({
              type: fieldApi.form.getFieldValue("type"),
              scope: fieldApi.form.getFieldValue("scope").trim() || null,
              summary: value,
            }) ?? undefined,
        }}
      >
        {(field) => (
          <Field
            hint="Otomat commits `type(scope): summary` and adds the issue reference itself."
            {...fieldErrorProps(field.state.meta)}
          >
            <FieldLabel>Summary</FieldLabel>
            <FieldControl>
              <Input
                value={field.state.value}
                disabled={disabled}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="unify run and workflow composers"
              />
            </FieldControl>
          </Field>
        )}
      </form.Field>
    </div>
  );
}
