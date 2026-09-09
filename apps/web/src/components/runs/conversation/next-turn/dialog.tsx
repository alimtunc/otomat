import { codexPermissionProblem, type ResolvedAgentConfig } from "@otomat/domain";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Field,
  FieldControl,
  FieldLabel,
  Icon,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@otomat/ui";
import { modelLabel } from "@web/lib/execution/labels";
import { fieldErrorProps } from "@web/lib/form";

import { NextTurnPermissions } from "./permissions";
import { useNextTurnForm } from "./use-form";

const INCOMPATIBLE_EFFORT = "Choose an effort compatible with the selected model.";

export function NextTurnModelDialog({
  runId,
  stepId,
  sessionId,
  config,
  className,
}: {
  runId: string;
  stepId: string;
  sessionId: string;
  config: ResolvedAgentConfig;
  className?: string;
}) {
  const {
    open,
    setOpen,
    form,
    permissionProblem,
    permissionSupport,
    effort,
    modelItems,
    effortItems,
    effortCompatible,
    optionsError,
    optionsReady,
    isPending,
  } = useNextTurnForm({ runId, stepId, sessionId, config });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className={className}
            title="Settings for next turn"
          >
            <Icon name="cpu" aria-hidden />
            {modelLabel(config.model)}
          </Button>
        }
      />
      <DialogContent aria-label="Settings for next turn">
        <DialogHeader>
          <DialogTitle>Settings for next turn</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <DialogBody className="flex flex-col gap-3">
            <p className="text-xs text-text-tertiary">
              Settings apply to the next turn. The active turn keeps its frozen configuration.
            </p>
            <form.Field
              name="model"
              validators={{
                onChange: ({ value }) =>
                  modelItems.some((item) => item.value === value)
                    ? undefined
                    : "Choose a model announced by this runtime.",
              }}
            >
              {(field) => (
                <Field {...fieldErrorProps(field.state.meta)}>
                  <FieldLabel>Model</FieldLabel>
                  <Select
                    items={modelItems}
                    value={field.state.value}
                    onValueChange={(value) => {
                      if (value !== null) field.handleChange(value);
                    }}
                  >
                    <FieldControl>
                      <SelectTrigger aria-label="Model for next turn">
                        <SelectValue />
                      </SelectTrigger>
                    </FieldControl>
                    <SelectContent>
                      {modelItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            </form.Field>
            {effort === undefined ? null : (
              <form.Field
                name="effort"
                validators={{
                  onChange: ({ value }) =>
                    effortItems.some((choice) => choice.value === value)
                      ? undefined
                      : INCOMPATIBLE_EFFORT,
                }}
              >
                {(field) => (
                  <Field {...fieldErrorProps(field.state.meta)}>
                    <FieldLabel>Effort</FieldLabel>
                    <Select
                      items={effortItems}
                      value={field.state.value}
                      onValueChange={(value) => {
                        if (value !== null) field.handleChange(value);
                      }}
                    >
                      <FieldControl>
                        <SelectTrigger aria-label="Effort for next turn">
                          <SelectValue />
                        </SelectTrigger>
                      </FieldControl>
                      <SelectContent>
                        {effortItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </form.Field>
            )}
            {effortCompatible ? null : (
              <p className="text-xs text-warning">{INCOMPATIBLE_EFFORT}</p>
            )}
            {permissionSupport ? (
              <form.Field
                name="permissions"
                validators={{ onChange: ({ value }) => codexPermissionProblem(value) ?? undefined }}
              >
                {(field) => (
                  <NextTurnPermissions
                    value={field.state.value}
                    onChange={field.handleChange}
                    support={permissionSupport}
                    error={permissionProblem}
                  />
                )}
              </form.Field>
            ) : null}
            {optionsError ? (
              <p className="text-xs text-danger">
                Could not read the runtime options. Refresh before confirming these settings.
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
                {([canSubmit, isSubmitting]) => (
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={
                      !canSubmit ||
                      !effortCompatible ||
                      permissionProblem !== null ||
                      !optionsReady ||
                      isPending
                    }
                    loading={isSubmitting || isPending}
                  >
                    Confirm next turn
                  </Button>
                )}
              </form.Subscribe>
            </div>
          </DialogBody>
        </form>
      </DialogContent>
    </Dialog>
  );
}
