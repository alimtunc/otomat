import type { ExecutionDefaults } from "@otomat/domain";
import { useForm } from "@tanstack/react-form";
import { useSaveExecutionDefaults } from "@web/api/daemon/mutations";
import { agentChoiceRuntimeId } from "@web/lib/agent/choice";
import { agentConfigRefusalMessage } from "@web/lib/agent/config-error";
import { selectionFromStored, storedFromSelection } from "@web/lib/execution/stored";
import { useState } from "react";

export function useExecutionDefaultsForm(defaults: ExecutionDefaults) {
  const save = useSaveExecutionDefaults();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { execution: selectionFromStored(defaults) },
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      const runtime = agentChoiceRuntimeId(value.execution.agent, []);
      try {
        const saved = await save.mutateAsync(storedFromSelection(value.execution, runtime));
        form.reset({ execution: selectionFromStored(saved) });
      } catch (error) {
        setSubmitError(agentConfigRefusalMessage(error, "the execution defaults"));
      }
    },
  });

  return { form, isSaving: save.isPending, isSaved: save.isSuccess, submitError };
}
