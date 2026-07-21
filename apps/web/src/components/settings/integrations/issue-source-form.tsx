import type { LinearWorkspaceContract, ProjectContract } from "@otomat/domain";
import {
  Button,
  Field,
  FieldControl,
  FieldLabel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from "@otomat/ui";
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
import { fieldErrorProps, type FieldMetaLike } from "@web/lib/form";
import { useState } from "react";

interface IssueSourceFormProps {
  workspace: LinearWorkspaceContract;
  projects: ProjectContract[];
}

interface MappingOption {
  value: string;
  label: string;
}

function MappingSelect({
  label,
  value,
  options,
  onValueChange,
}: {
  label: string;
  value: string;
  options: MappingOption[];
  onValueChange: (value: string) => void;
}) {
  return (
    <Select
      items={options}
      value={value}
      onValueChange={(nextValue) => {
        if (nextValue !== null) onValueChange(nextValue);
      }}
    >
      <FieldControl>
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
      </FieldControl>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface MappingFieldProps {
  label: string;
  value: string;
  options: MappingOption[];
  meta: FieldMetaLike;
  onValueChange(value: string): void;
}

function MappingField({ label, value, options, meta, onValueChange }: MappingFieldProps) {
  return (
    <Field {...fieldErrorProps(meta)}>
      <FieldLabel>{label}</FieldLabel>
      <MappingSelect label={label} value={value} options={options} onValueChange={onValueChange} />
    </Field>
  );
}

function LinearProjectField({
  workspace,
  teamId,
  value,
  meta,
  onValueChange,
}: {
  workspace: LinearWorkspaceContract;
  teamId: string;
  value: string;
  meta: FieldMetaLike;
  onValueChange(value: string): void;
}) {
  const options = [
    { value: WHOLE_TEAM, label: "Whole team" },
    ...workspace.projects.flatMap((project) =>
      project.team_ids.includes(teamId) ? [{ value: project.id, label: project.name }] : [],
    ),
  ];
  return (
    <MappingField
      label="Linear project"
      value={value}
      options={options}
      meta={meta}
      onValueChange={onValueChange}
    />
  );
}

export function IssueSourceForm({ workspace, projects }: IssueSourceFormProps) {
  const create = useCreateIssueSource();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const teamOptions = workspace.teams.map((team) => ({
    value: team.id,
    label: `${team.key} · ${team.name}`,
  }));
  const projectOptions = projects.map((project) => ({ value: project.id, label: project.name }));

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
              loading={create.isPending}
              disabled={projectId === "" || teamId === "" || create.isPending}
            >
              Map source
            </Button>
          )}
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
