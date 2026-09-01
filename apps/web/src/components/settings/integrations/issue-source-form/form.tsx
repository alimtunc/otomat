import type { LinearWorkspaceContract, ProjectContract } from "@otomat/domain";
import { Button } from "@otomat/ui";
import { WHOLE_TEAM } from "@web/components/settings/integrations/issue-source-selection";
import { SavedNotice } from "@web/components/settings/saved-notice";

import { LinearProjectField } from "./linear-project-field";
import { MappingField } from "./mapping-field";
import { useIssueSourceForm } from "./use-form";

export interface IssueSourceFormProps {
  workspace: LinearWorkspaceContract;
  /** The connection whose workspace is shown; every source this form creates names it. */
  connectionId: string;
  projects: ProjectContract[];
  onCreated?: () => void;
}

export function IssueSourceForm({
  workspace,
  connectionId,
  projects,
  onCreated,
}: IssueSourceFormProps) {
  const { form, pending, created, submitError, teamOptions, projectOptions } = useIssueSourceForm(
    workspace,
    projects,
    connectionId,
    onCreated,
  );

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
            <MappingField
              label="Linear team"
              value={field.state.value}
              options={teamOptions}
              meta={field.state.meta}
              onValueChange={(teamId) => {
                field.handleChange(teamId);
                form.setFieldValue("linearProjectId", WHOLE_TEAM);
              }}
            />
          )}
        </form.Field>

        <form.Subscribe selector={(state) => state.values.teamId}>
          {(teamId) => (
            <form.Field name="linearProjectId">
              {(field) => (
                <LinearProjectField
                  workspace={workspace}
                  teamId={teamId}
                  value={field.state.value}
                  meta={field.state.meta}
                  onValueChange={field.handleChange}
                />
              )}
            </form.Field>
          )}
        </form.Subscribe>

        <form.Field name="projectId">
          {(field) => (
            <MappingField
              label="Otomat project"
              value={field.state.value}
              options={projectOptions}
              meta={field.state.meta}
              onValueChange={field.handleChange}
            />
          )}
        </form.Field>
      </div>

      <div className="flex items-center gap-2">
        <form.Subscribe
          selector={(state) => [state.values.projectId, state.values.teamId] as const}
        >
          {([projectId, teamId]) => (
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={pending}
              disabled={projectId === "" || teamId === "" || pending}
            >
              Map source
            </Button>
          )}
        </form.Subscribe>
        <form.Subscribe selector={(state) => state.isDefaultValue}>
          {(isDefault) =>
            created && isDefault && submitError === null ? (
              <SavedNotice>Mapped Linear source to a local project</SavedNotice>
            ) : null
          }
        </form.Subscribe>
      </div>

      {submitError === null ? null : (
        <p role="alert" className="text-xs text-danger">
          {submitError}
        </p>
      )}
    </form>
  );
}
