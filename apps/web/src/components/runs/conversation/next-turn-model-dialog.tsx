import type { ProviderOptionKey, ResolvedAgentConfig } from "@otomat/domain";
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
import { useForm, useStore } from "@tanstack/react-form";
import { useRuntimeModels, useRuntimeProviderOptions } from "@web/api/daemon/queries";
import { useSetNextTurnModel } from "@web/api/runs/step-mutations";
import { modelLabel } from "@web/lib/execution/labels";
import { fieldErrorProps } from "@web/lib/form";
import { useState } from "react";

const INCOMPATIBLE_EFFORT = "Choose an effort compatible with the selected model.";

function isEffortKey(key: ProviderOptionKey): boolean {
  return key === "effort" || key === "reasoning_effort";
}

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
  const [open, setOpen] = useState(false);
  const catalog = useRuntimeModels(open ? config.runtime : null);
  const mutation = useSetNextTurnModel(runId, stepId);
  const form = useForm({
    defaultValues: {
      model: config.model?.id ?? "",
      effort: config.options.effort ?? config.options.reasoning_effort ?? "",
    },
    onSubmit: ({ value }) => {
      const descriptor = options.data?.options.find((option) => isEffortKey(option.key));
      const nextOptions = { ...config.options };
      delete nextOptions.effort;
      delete nextOptions.reasoning_effort;
      if (descriptor && value.effort) nextOptions[descriptor.key] = value.effort;
      mutation.mutate(
        {
          agent_session_id: sessionId,
          current_config_hash: config.config_hash,
          model: value.model,
          options: nextOptions,
        },
        { onSuccess: () => setOpen(false) },
      );
    },
  });
  const model = useStore(form.store, (state) => state.values.model);
  const effortValue = useStore(form.store, (state) => state.values.effort);
  const options = useRuntimeProviderOptions(open ? config.runtime : null, model || null);
  const effort = options.data?.options.find((option) => isEffortKey(option.key));
  const modelItems = (catalog.data?.models ?? []).map((item) => ({
    value: item.id,
    label: item.label,
  }));
  const effortItems = (effort?.choices ?? []).map((choice) => ({
    value: choice.value,
    label: choice.value,
  }));
  const effortCompatible =
    effort === undefined || effort.choices.some((choice) => choice.value === effortValue);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className={className}
            title="Model for next turn"
          >
            <Icon name="cpu" aria-hidden />
            {modelLabel(config.model)}
          </Button>
        }
      />
      <DialogContent aria-label="Model for next turn">
        <DialogHeader>
          <DialogTitle>Model for next turn</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <DialogBody className="flex flex-col gap-3">
            <p className="text-xs text-text-tertiary">
              The active turn keeps its current model. This pending choice is saved now, and the
              next queued message freezes its exact configuration.
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
                    effort.choices.some((choice) => choice.value === value)
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
            {options.isError ? (
              <p className="text-xs text-danger">
                Could not read this model’s options — the effort cannot be confirmed.
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
                      !canSubmit || !effortCompatible || !options.isSuccess || mutation.isPending
                    }
                    loading={isSubmitting || mutation.isPending}
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
