import type { ExecutionDefaults } from "@otomat/domain";
import { toast } from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import { useSavePullRequestGenerator } from "@web/api/daemon/mutations";
import { agentChoiceRuntimeId } from "@web/lib/agent-choice";
import { agentConfigRefusalMessage } from "@web/lib/agent-config-error";
import { selectionFromStored, storedFromSelection } from "@web/lib/execution/stored";
import { useState } from "react";

export function usePullRequestGeneratorForm(generator: ExecutionDefaults) {
  const save = useSavePullRequestGenerator();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { execution: selectionFromStored(generator) },
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      const runtime = agentChoiceRuntimeId(value.execution.agent, []);
      try {
        const saved = await save.mutateAsync(storedFromSelection(value.execution, runtime));
        toast.success("PR metadata generator saved");
        form.reset({ execution: selectionFromStored(saved) });
      } catch (error) {
        setSubmitError(agentConfigRefusalMessage(error, "the PR metadata generator"));
      }
    },
  });

  return { form, isSaving: save.isPending, submitError };
}
