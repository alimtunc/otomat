import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_HEADLINES,
  type NotificationPreferences,
} from "@otomat/domain";
import { Button, Switch } from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import { AppearanceRow } from "@web/components/settings/appearance-row";
import type { NotificationSettingsResult } from "@web/components/settings/notifications/use-notification-settings";

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
              label={NOTIFICATION_HEADLINES[category]}
              description="Allow native notifications when Otomat is in the background."
              control={
                <Switch
                  aria-label={NOTIFICATION_HEADLINES[category]}
                  checked={field.state.value}
                  onCheckedChange={field.handleChange}
                  onBlur={field.handleBlur}
                />
              }
            />
          )}
        </form.Field>
      ))}
      <form.Field name="detail">
        {(field) => (
          <AppearanceRow
            label="Show category"
            description="Off: a generic update. On: only the kind of request or result. Prompts, code, paths and responses are never included."
            control={
              <Switch
                aria-label="Show category"
                checked={field.state.value === "category"}
                onCheckedChange={(checked) => field.handleChange(checked ? "category" : "generic")}
                onBlur={field.handleBlur}
              />
            }
          />
        )}
      </form.Field>
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
