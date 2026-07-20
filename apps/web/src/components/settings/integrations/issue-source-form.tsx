import type { LinearWorkspaceContract, ProjectContract } from "@otomat/domain";
import { Button, Field, FieldControl, FieldLabel, toast } from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import { linearErrorMessage, useCreateIssueSource } from "@web/api/linear/mutations";
import { fieldErrorProps } from "@web/lib/form";
import { useState } from "react";

const WHOLE_TEAM = "";

interface IssueSourceFormProps {
  workspace: LinearWorkspaceContract;
  projects: ProjectContract[];
}

/**
 * Binds a Linear team (optionally one of its projects) to an existing local
 * project. Linear never creates a project or picks a repository: the local
 * project chosen here is what decides where an imported issue launches its run.
 */
export function IssueSourceForm({ workspace, projects }: IssueSourceFormProps) {
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
      const team = workspace.teams.find((entry) => entry.id === value.teamId);
      if (team === undefined) {
        setSubmitError("Pick a Linear team.");
        return;
      }
      const linearProject = workspace.projects.find((entry) => entry.id === value.linearProjectId);
      try {
        await create.mutateAsync({
          project_id: value.projectId,
          external_team_id: team.id,
          external_team_key: team.key,
          external_team_name: team.name,
          external_project_id: linearProject?.id ?? WHOLE_TEAM,
          external_project_name: linearProject?.name ?? WHOLE_TEAM,
        });
        toast.success(`Mapped ${team.key} to a local project`);
        form.reset();
      } catch (error) {
        setSubmitError(linearErrorMessage(error));
      }
    },
  });

  return (
    <form
      className="flex flex-col gap-3 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <form.Field name="teamId">
          {(field) => (
            <Field {...fieldErrorProps(field.state.meta)}>
              <FieldLabel>Linear team</FieldLabel>
              <FieldControl>
                <select
                  className="h-7.25 w-full rounded-md border border-border-subtle bg-card px-2 text-sm text-text-secondary"
                  value={field.state.value}
                  aria-label="Linear team"
                  onChange={(event) => field.handleChange(event.target.value)}
                >
                  {workspace.teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.key} · {team.name}
                    </option>
                  ))}
                </select>
              </FieldControl>
            </Field>
          )}
        </form.Field>

        <form.Subscribe selector={(state) => state.values.teamId}>
          {(teamId) => (
            <form.Field name="linearProjectId">
              {(field) => (
                <Field {...fieldErrorProps(field.state.meta)}>
                  <FieldLabel>Linear project</FieldLabel>
                  <FieldControl>
                    <select
                      className="h-7.25 w-full rounded-md border border-border-subtle bg-card px-2 text-sm text-text-secondary"
                      value={field.state.value}
                      aria-label="Linear project"
                      onChange={(event) => field.handleChange(event.target.value)}
                    >
                      <option value={WHOLE_TEAM}>Whole team</option>
                      {workspace.projects
                        .filter((project) => project.team_ids.includes(teamId))
                        .map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.name}
                          </option>
                        ))}
                    </select>
                  </FieldControl>
                </Field>
              )}
            </form.Field>
          )}
        </form.Subscribe>

        <form.Field name="projectId">
          {(field) => (
            <Field {...fieldErrorProps(field.state.meta)}>
              <FieldLabel>Otomat project</FieldLabel>
              <FieldControl>
                <select
                  className="h-7.25 w-full rounded-md border border-border-subtle bg-card px-2 text-sm text-text-secondary"
                  value={field.state.value}
                  aria-label="Otomat project"
                  onChange={(event) => field.handleChange(event.target.value)}
                >
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </FieldControl>
            </Field>
          )}
        </form.Field>
      </div>

      <div className="flex items-center gap-2">
        <form.Subscribe selector={(state) => state.values.projectId}>
          {(projectId) => (
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={create.isPending}
              disabled={projectId === "" || create.isPending}
            >
              Map source
            </Button>
          )}
        </form.Subscribe>
        {projects.length === 0 ? (
          <span className="text-xs text-text-tertiary">
            Register a repository first — a source needs a local project to import into.
          </span>
        ) : null}
      </div>

      {submitError === null ? null : (
        <p role="alert" className="text-xs text-danger">
          {submitError}
        </p>
      )}
    </form>
  );
}
