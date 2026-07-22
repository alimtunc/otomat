import type { LinearWorkspaceContract, ProjectContract } from "@otomat/domain";
import { toast } from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import {
  isSupersededLinearError,
  linearErrorMessage,
  useCreateIssueSource,
} from "@web/api/linear/mutations";
import {
  buildIssueSourceRequest,
  WHOLE_TEAM,
} from "@web/components/settings/integrations/issue-source-selection";
import { useState } from "react";

export function useIssueSourceForm(
  workspace: LinearWorkspaceContract,
  projects: ProjectContract[],
) {
  const create = useCreateIssueSource();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: {
      projectId: projects[0]?.id ?? "",
      teamId: workspace.teams[0]?.id ?? "",
      linearProjectId: WHOLE_TEAM,
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      const resolution = buildIssueSourceRequest(workspace, value);
      if (!resolution.ok) {
        setSubmitError(resolution.message);
        return;
      }
      try {
        await create.mutateAsync(resolution.request);
        toast.success("Mapped Linear source to a local project");
        form.reset();
      } catch (error) {
        if (isSupersededLinearError(error)) return;
        setSubmitError(linearErrorMessage(error));
      }
    },
  });

  return {
    form,
    pending: create.isPending,
    submitError,
    teamOptions: workspace.teams.map((team) => ({
      value: team.id,
      label: `${team.key} · ${team.name}`,
    })),
    projectOptions: projects.map((project) => ({ value: project.id, label: project.name })),
  };
}
