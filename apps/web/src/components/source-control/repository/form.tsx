import { BRANCH_REF_MAX_LENGTH } from "@otomat/domain";
import { Field, FieldControl, FieldLabel, Input } from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import type {
  useGenerateRepositoryPullRequest,
  usePublishRepositoryPullRequest,
} from "@web/api/prs/mutations";
import { RepositoryPullRequestPublication } from "@web/components/source-control/repository/publication";
import { fieldErrorProps, requiredTrimmed } from "@web/lib/form";

export interface RepositoryPullRequestFormProps {
  repositoryId: string;
  defaultBranch: string;
  revision: string;
  publish: ReturnType<typeof usePublishRepositoryPullRequest>;
  generate: ReturnType<typeof useGenerateRepositoryPullRequest>;
  onPublished: () => void;
}

export function RepositoryPullRequestForm({
  repositoryId,
  defaultBranch,
  revision,
  publish,
  generate,
  onPublished,
}: RepositoryPullRequestFormProps) {
  const form = useForm({ defaultValues: { base_ref: defaultBranch } });
  const busy = publish.isPending || generate.isPending;
  return (
    <>
      <form.Field
        name="base_ref"
        validators={{ onChange: requiredTrimmed("Target branch is required.") }}
      >
        {(field) => (
          <Field {...fieldErrorProps(field.state.meta)}>
            <FieldLabel>Target branch</FieldLabel>
            <FieldControl>
              <Input
                value={field.state.value}
                onChange={(event) => {
                  field.handleChange(event.target.value);
                  publish.reset();
                  generate.reset();
                }}
                onBlur={field.handleBlur}
                placeholder={defaultBranch}
                maxLength={BRANCH_REF_MAX_LENGTH}
                disabled={busy}
              />
            </FieldControl>
          </Field>
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.values.base_ref.trim()}>
        {(baseRef) =>
          baseRef === "" ? null : (
            <RepositoryPullRequestPublication
              key={baseRef}
              repositoryId={repositoryId}
              baseRef={baseRef}
              revision={revision}
              publish={publish}
              generate={generate}
              onPublished={onPublished}
            />
          )
        }
      </form.Subscribe>
    </>
  );
}
