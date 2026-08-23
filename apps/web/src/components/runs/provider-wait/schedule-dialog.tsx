import type { StepProviderWait } from "@otomat/domain";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldControl,
  FieldLabel,
  Input,
} from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import { useScheduleProviderResume } from "@web/api/runs/mutations";
import { fromDateTimeLocal, toDateTimeLocal } from "@web/lib/datetime-local";
import { fieldErrorProps } from "@web/lib/form";

export interface ProviderWaitScheduleDialogProps {
  runId: string;
  wait: StepProviderWait;
  openedAt: string;
  onClose: () => void;
}

const HOUR_MS = 60 * 60 * 1000;

const PRESET_HOURS = [1, 3];

export function ProviderWaitScheduleDialog({
  runId,
  wait,
  openedAt,
  onClose,
}: ProviderWaitScheduleDialogProps) {
  const schedule = useScheduleProviderResume(runId);
  const suggestion =
    wait.provider_resume_at ?? new Date(new Date(openedAt).getTime() + HOUR_MS).toISOString();
  const form = useForm({
    defaultValues: { at: toDateTimeLocal(new Date(suggestion)) },
    onSubmit: async ({ value }) => {
      const instant = fromDateTimeLocal(value.at);
      if (instant === null) return;
      await schedule.mutateAsync(instant);
      onClose();
    },
  });

  const pick = (hours: number, now: number): void => {
    schedule.mutate(new Date(now + hours * HOUR_MS).toISOString(), {
      onSuccess: onClose,
    });
  };

  return (
    <Dialog
      open
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent aria-label="Schedule this resume">
        <DialogHeader>
          <DialogTitle>Schedule the resume</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <DialogBody className="flex flex-col gap-3">
            <p className="m-0 text-sm text-text-secondary">
              At this time Otomat resumes the same run, the same step and the same worktree — with
              the desktop closed if need be. Nothing new is created.
            </p>
            <div className="flex flex-wrap gap-2">
              {PRESET_HOURS.map((hours) => (
                <Button
                  key={hours}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={schedule.isPending}
                  onClick={() => pick(hours, Date.now())}
                >
                  In {hours} {hours === 1 ? "hour" : "hours"}
                </Button>
              ))}
            </div>
            <form.Field
              name="at"
              validators={{
                onChange: ({ value }) => {
                  const instant = fromDateTimeLocal(value);
                  if (instant === null) return "Pick a date and a time.";
                  return instant <= new Date().toISOString()
                    ? "Pick a time in the future."
                    : undefined;
                },
              }}
            >
              {(field) => (
                <Field {...fieldErrorProps(field.state.meta)}>
                  <FieldLabel>Or a time of your own</FieldLabel>
                  <FieldControl>
                    <Input
                      type="datetime-local"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      aria-label="Resume at"
                    />
                  </FieldControl>
                </Field>
              )}
            </form.Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Keep waiting
            </Button>
            <form.Subscribe selector={(state) => state.canSubmit}>
              {(canSubmit) => (
                <Button
                  type="submit"
                  size="sm"
                  loading={schedule.isPending}
                  disabled={!canSubmit || schedule.isPending}
                >
                  Schedule resume
                </Button>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
