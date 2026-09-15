import {
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
  type NotificationPreferences,
} from "@otomat/domain";
import { Button, Switch } from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import { AppearanceRow } from "@web/components/settings/appearance-row";
import type { NotificationSettingsResult } from "@web/components/settings/notifications/use-notification-settings";

const CATEGORY_LABELS = {
  permission: "Permission or choice requested",
  question: "A question needs your answer",
  review: "Work is ready to review",
  completed: "Run completed",
  blocked: "Work failed or is blocked",
} satisfies Record<NotificationCategory, string>;

export interface NotificationPreferencesFormProps {
  preferences: NotificationPreferences;
  save: NotificationSettingsResult["save"];
}

export function NotificationPreferencesForm({
  preferences,
  save,
}: NotificationPreferencesFormProps) {
  const form = useForm({
    defaultValues: preferences,
    onSubmit: ({ value }) => {
      save.mutate(value, { onSuccess: (snapshot) => form.reset(snapshot.preferences) });
    },
  });
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
      className="rounded-lg border border-border-subtle bg-card px-4"
    >
      {NOTIFICATION_CATEGORIES.map((category) => (
        <form.Field key={category} name={`categories.${category}`}>
          {(field) => (
            <AppearanceRow
              label={CATEGORY_LABELS[category]}
              description="Allow native notifications when Otomat is in the background."
              control={
                <Switch
                  aria-label={CATEGORY_LABELS[category]}
                  checked={field.state.value}
                  onCheckedChange={field.handleChange}
                  onBlur={field.handleBlur}
                />
              }
            />
          )}
        </form.Field>
      ))}
      {save.error === null ? null : (
        <p role="alert" className="text-sm text-danger">
          {save.error.message}
        </p>
      )}
      <form.Subscribe
        selector={(state) => ({ canSubmit: state.canSubmit, submitting: state.isSubmitting })}
      >
        {({ canSubmit, submitting }) => (
          <Button
            className="my-4"
            type="submit"
            disabled={!canSubmit || submitting || save.isPending}
            loading={save.isPending}
          >
            Save notifications
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
