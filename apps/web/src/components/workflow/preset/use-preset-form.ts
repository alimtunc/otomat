import {
  workflowPresetPlanSchema,
  type SaveWorkflowPresetRequest,
  type WorkflowPresetContract,
} from "@otomat/domain";
import { useForm, useStore } from "@tanstack/react-form";
import {
  useCreateWorkflowPreset,
  useUpdateWorkflowPreset,
} from "@web/api/workflow-presets/mutations";
import { usePlanDraft } from "@web/components/workflow/use-plan-draft";
import { hasText } from "@web/lib/form";
import { isWorkflowNodeComplete, type WorkflowNodeDraft } from "@web/lib/workflow-draft";
import { draftsFromPresetPlan, presetPlanFromDrafts } from "@web/lib/workflow/preset";
import { presetRefusalMessage } from "@web/lib/workflow/preset-error";
import { useState } from "react";

export interface UsePresetFormOptions {
  /** The preset being edited; null composes a new one. */
  preset: WorkflowPresetContract | null;
  /** What a new preset starts from — the launcher's current composition, or nothing at all. */
  initialSteps: WorkflowNodeDraft[];
  /** The project a `project`-scoped preset would belong to; undefined leaves only the global scope. */
  projectId: string | undefined;
  onSaved: (preset: WorkflowPresetContract) => void;
}

/** Owns a preset's name, scope and composition; the preset itself only changes when a save succeeds. */
export function usePresetForm({ preset, initialSteps, projectId, onSaved }: UsePresetFormOptions) {
  const create = useCreateWorkflowPreset();
  const update = useUpdateWorkflowPreset();
  const plan = usePlanDraft(() =>
    preset === null ? initialSteps : draftsFromPresetPlan(preset.plan),
  );
  const [refusal, setRefusal] = useState<string | null>(null);

  const defaultValues = {
    name: preset?.name ?? "",
    scope: preset?.scope ?? "global",
  };

  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      const parsed = workflowPresetPlanSchema.safeParse(presetPlanFromDrafts(plan.steps));
      if (!parsed.success) {
        setRefusal(parsed.error.issues[0]?.message ?? "This workflow structure is invalid.");
        return;
      }
      const owner = value.scope === "project" ? projectId : undefined;
      const request: SaveWorkflowPresetRequest =
        owner === undefined
          ? { scope: "global", name: value.name.trim(), plan: parsed.data }
          : { scope: "project", project_id: owner, name: value.name.trim(), plan: parsed.data };
      try {
        const saved =
          preset === null
            ? await create.mutateAsync(request)
            : await update.mutateAsync({ id: preset.id, request });
        setRefusal(null);
        onSaved(saved);
      } catch (error) {
        setRefusal(presetRefusalMessage(error, "save this preset"));
      }
    },
  });

  const values = useStore(form.store, (state) => state.values);

  return {
    form,
    plan,
    /** The daemon's own refusal sentence, kept until the next attempt. */
    refusal,
    canSave:
      hasText(values.name) &&
      (values.scope === "global" || projectId !== undefined) &&
      plan.steps.every(isWorkflowNodeComplete),
    isPending: create.isPending || update.isPending,
  };
}

export type PresetForm = ReturnType<typeof usePresetForm>["form"];
