import type { SourceControlResponse } from "@otomat/domain";
import {
  Button,
  Checkbox,
  DialogContent,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldControl,
  FieldLabel,
  Input,
  Textarea,
  toast,
} from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { useRepositories } from "@web/api/daemon/queries";
import { usePublishRepositoryPullRequest } from "@web/api/source-control/publication";
import { sourceControlMessage } from "@web/components/source-control/refusal";
import { fieldErrorProps } from "@web/lib/form";

export interface RepositoryPullRequestDialogProps {
  repositoryId: string;
  changes: SourceControlResponse;
  onClose: () => void;
}

export function RepositoryPullRequestDialog({
  repositoryId,
  changes,
  onClose,
}: RepositoryPullRequestDialogProps) {
  const repositories = useRepositories();
  const base =
    repositories.data?.find((entry) => entry.id === repositoryId)?.default_branch ?? "main";
  const publish = usePublishRepositoryPullRequest(repositoryId);
  const navigate = useNavigate();
  const form = useForm({
    defaultValues: {
      head_ref: [base, "main", "master", "HEAD"].includes(changes.branch) ? "" : changes.branch,
      base_ref: base,
      title: "",
      body: "",
      draft: true,
    },
    onSubmit: async ({ value }) => {
      try {
        const pullRequest = await publish.mutateAsync({ ...value, revision: changes.revision });
        toast.success(`Pull request #${pullRequest.number} published`);
        onClose();
        void navigate({
          to: "/pull-requests/$pullRequestId/diff",
          params: { pullRequestId: pullRequest.id },
        });
      } catch (error) {
        toast.error(sourceControlMessage(error));
      }
    },
  });
  return (
    <DialogContent>
      <DialogHeader className="flex-col items-start gap-2 pr-10">
        <DialogTitle>Publish project commits</DialogTitle>
        <DialogDescription>
          Publish commits from {changes.branch}. A different source branch is created from its
          current commit. Uncommitted files stay local.
        </DialogDescription>
      </DialogHeader>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <DialogBody className="flex flex-col gap-4">
          {(
            [
              {
                name: "head_ref",
                label: "Source branch",
                placeholder: "feat/my-changes",
                maxLength: 120,
              },
              { name: "base_ref", label: "Target branch", placeholder: "main", maxLength: 120 },
              {
                name: "title",
                label: "PR title",
                placeholder: "Describe the changes",
                maxLength: 256,
              },
            ] as const
          ).map((input) => (
            <form.Field
              key={input.name}
              name={input.name}
              validators={{
                onChange: ({ value }) =>
                  value.trim() === "" ? `${input.label} is required.` : undefined,
              }}
            >
              {(field) => (
                <Field {...fieldErrorProps(field.state.meta)}>
                  <FieldLabel>{input.label}</FieldLabel>
                  <FieldControl>
                    <Input
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value)}
                      onBlur={field.handleBlur}
                      placeholder={input.placeholder}
                      maxLength={input.maxLength}
                      disabled={publish.isPending}
                    />
                  </FieldControl>
                </Field>
              )}
            </form.Field>
          ))}
          <form.Field name="body">
            {(field) => (
              <Field>
                <FieldLabel>Description</FieldLabel>
                <FieldControl>
                  <Textarea
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    onBlur={field.handleBlur}
                    rows={4}
                    maxLength={65000}
                    disabled={publish.isPending}
                  />
                </FieldControl>
              </Field>
            )}
          </form.Field>
          <form.Field name="draft">
            {(field) => (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={field.state.value}
                  onCheckedChange={field.handleChange}
                  onBlur={field.handleBlur}
                  disabled={publish.isPending}
                />
                Create as draft
              </label>
            )}
          </form.Field>
          {changes.staged.length > 0 ? (
            <p role="alert" className="text-sm text-warning">
              Commit your staged changes first.
            </p>
          ) : null}
          {publish.error === null ? null : (
            <p role="alert" className="text-sm text-danger">
              {sourceControlMessage(publish.error)}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={publish.isPending}>
            Cancel
          </Button>
          <form.Subscribe selector={(state) => [state.canSubmit, state.values] as const}>
            {([canSubmit, values]) => (
              <Button
                type="submit"
                loading={publish.isPending}
                disabled={
                  !canSubmit ||
                  changes.staged.length > 0 ||
                  !values.title.trim() ||
                  !values.head_ref.trim() ||
                  !values.base_ref.trim()
                }
              >
                Push commits & create / update PR
              </Button>
            )}
          </form.Subscribe>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
