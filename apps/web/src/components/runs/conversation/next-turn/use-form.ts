import {
  codexPermissionProblem,
  type ProviderOptionKey,
  type ResolvedAgentConfig,
} from "@otomat/domain";
import { useForm, useStore } from "@tanstack/react-form";
import { useRuntimeModels, useRuntimeProviderOptions } from "@web/api/daemon/queries";
import { useSetNextTurnModel } from "@web/api/runs/step-mutations";
import { useState } from "react";

const isEffortKey = (key: ProviderOptionKey): boolean =>
  key === "effort" || key === "reasoning_effort";

export function useNextTurnForm({
  runId,
  stepId,
  sessionId,
  config,
}: {
  runId: string;
  stepId: string;
  sessionId: string;
  config: ResolvedAgentConfig;
}) {
  const [open, setOpen] = useState(false);
  const catalog = useRuntimeModels(open ? config.runtime : null);
  const mutation = useSetNextTurnModel(runId, stepId);
  const form = useForm({
    defaultValues: {
      model: config.model?.id ?? "",
      effort: config.options.effort ?? config.options.reasoning_effort ?? "",
      permissions: config.options,
    },
    onSubmit: ({ value }) => {
      const descriptor = options.data?.options.find((option) => isEffortKey(option.key));
      const nextOptions = { ...value.permissions };
      delete nextOptions.effort;
      delete nextOptions.reasoning_effort;
      if (descriptor && value.effort) nextOptions[descriptor.key] = value.effort;
      mutation.mutate(
        {
          agent_session_id: sessionId,
          current_config_hash: config.config_hash,
          model: value.model || null,
          options: nextOptions,
        },
        { onSuccess: () => setOpen(false) },
      );
    },
  });
  const { model, effort: effortValue, permissions } = useStore(form.store, (state) => state.values);
  const permissionProblem = config.runtime === "codex" ? codexPermissionProblem(permissions) : null;
  const options = useRuntimeProviderOptions(open ? config.runtime : null, model || null);
  const permissionSupport = config.runtime === "codex" ? options.data : undefined;
  const effort = options.data?.options.find((option) => isEffortKey(option.key));
  const modelItems = [
    { value: "", label: "Provider default" },
    ...(catalog.data?.models ?? []).map((item) => ({ value: item.id, label: item.label })),
  ];
  const effortItems = [
    { value: "", label: "Runtime default" },
    ...(effort?.choices ?? []).map((choice) => ({ value: choice.value, label: choice.value })),
  ];
  const effortCompatible =
    effort === undefined || effortItems.some((choice) => choice.value === effortValue);

  return {
    open,
    setOpen,
    form,
    permissionProblem,
    permissionSupport,
    effort,
    modelItems,
    effortItems,
    effortCompatible,
    optionsError: options.isError,
    optionsReady: options.isSuccess,
    isPending: mutation.isPending,
  };
}
