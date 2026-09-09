import {
  COMMIT_SUBJECT_MAX_LENGTH,
  COMMIT_TYPES,
  commitScopeViolation,
  commitSummaryBudget,
  commitSummaryViolation,
} from "@otomat/domain";
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
  generationRefusal: string | null;
}

const TYPE_ITEMS = COMMIT_TYPES.map((type) => ({ value: type, label: type }));

function summaryHint(budget: number): string {
  return `Otomat commits \`type(scope): summary\` — that subject is limited to ${String(COMMIT_SUBJECT_MAX_LENGTH)} characters, leaving ${String(budget)} for the summary. The PR title adds the issue reference.`;
}

export function PullRequestSubjectFields({
  form,
  disabled,
  generationRefusal,
}: PullRequestSubjectFieldsProps) {
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
      <form.Subscribe
        selector={(state) =>
          commitSummaryBudget({
            type: state.values.type,
            scope: state.values.scope.trim() || null,
          })
        }
      >
        {(budget) => (
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
            {(field) => {
              const own = fieldErrorProps(field.state.meta);
              return (
                <Field
                  hint={summaryHint(budget)}
                  invalid={own.invalid || generationRefusal !== null}
                  error={own.error ?? generationRefusal ?? undefined}
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
              );
            }}
          </form.Field>
        )}
      </form.Subscribe>
    </div>
  );
}
