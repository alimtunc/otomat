import type {
  GitHubConnectionContract,
  PreparePullRequestRequest,
  PullRequestContract,
  PullRequestDraft,
} from "@otomat/domain";
import {
  Button,
  Chip,
  Field,
  FieldControl,
  FieldLabel,
  Input,
  PRStatusBadge,
  Textarea,
} from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import { PullRequestConnectionPanel } from "@web/components/runs/pr/connection-panel";
import { PullRequestModeField } from "@web/components/runs/pr/mode-field";
import { fieldErrorProps } from "@web/lib/form";

import { initialPublicationMode, pullRequestViewModel } from "./model";

interface PullRequestFormProps {
  pullRequest: PullRequestContract | null;
  branch: string | null;
  connection: GitHubConnectionContract;
  onSubmit: (value: PreparePullRequestRequest) => Promise<boolean>;
  /** Asks the run's agent for a draft; null when it failed (the mutation owns the toast). */
  onDraft: () => Promise<PullRequestDraft | null>;
  onConnect: () => void;
  isPending: boolean;
  isDrafting: boolean;
  isConnecting: boolean;
  canPublish: boolean;
}

export function PullRequestForm({
  pullRequest,
  branch,
  connection,
  onSubmit,
  onDraft,
  onConnect,
  isPending,
  isDrafting,
  isConnecting,
  canPublish,
}: PullRequestFormProps) {
  const form = useForm({
    defaultValues: {
      title: pullRequest?.title ?? "",
      body: pullRequest?.body ?? "",
      branch: pullRequest?.head_ref ?? "",
      mode: initialPublicationMode(pullRequest),
    },
    onSubmit: async ({ value, formApi }) => {
      const headRef = value.branch.trim();
      const submitted = {
        title: value.title.trim(),
        body: value.body,
        mode: value.mode,
        ...(headRef === "" ? {} : { head_ref: headRef }),
      };
      if (await onSubmit(submitted)) formApi.reset({ ...value, title: submitted.title });
    },
  });

  const terminal = pullRequest?.status === "merged" || pullRequest?.status === "closed";
  const branchLocked = pullRequest?.number !== null && pullRequest?.number !== undefined;

  async function fillFromDraft(): Promise<void> {
    const draft = await onDraft();
    if (draft === null) return;
    form.setFieldValue("title", draft.title);
    form.setFieldValue("body", draft.body);
    if (!branchLocked) form.setFieldValue("branch", draft.branch);
  }

  return (
    <form
      className="flex max-w-2xl flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Subscribe
        selector={(state) => [state.canSubmit, state.isDirty, state.values.mode] as const}
      >
        {([canSubmit, isDirty, mode]) => {
          const model = pullRequestViewModel(connection, pullRequest, canPublish, isDirty, mode);
          const fieldsDisabled = terminal || model.actionPending || isPending;
          return (
            <>
              <div className="flex items-center gap-2">
                {pullRequest ? <PRStatusBadge status={pullRequest.status} /> : null}
                <Chip tone={model.stateLabel === "Up to date" ? "success" : "neutral"}>
                  {model.stateLabel}
                </Chip>
                {branch ? <Chip tone="ghost">{branch}</Chip> : null}
              </div>
              <PullRequestConnectionPanel
                model={model}
                onConnect={onConnect}
                isConnecting={isConnecting}
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void fillFromDraft()}
                  loading={isDrafting}
                  disabled={fieldsDisabled || isDrafting}
                >
                  Draft with AI
                </Button>
              </div>
              <form.Field
                name="title"
                validators={{
                  onChange: ({ value }) =>
                    value.trim().length === 0 ? "A title is required." : undefined,
                }}
              >
                {(field) => (
                  <Field {...fieldErrorProps(field.state.meta)}>
                    <FieldLabel>Title</FieldLabel>
                    <FieldControl>
                      <Input
                        value={field.state.value}
                        disabled={fieldsDisabled}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        placeholder="Summarize the change…"
                      />
                    </FieldControl>
                  </Field>
                )}
              </form.Field>
              <form.Field name="body">
                {(field) => (
                  <Field hint="Optional description shown on GitHub.">
                    <FieldLabel>Description</FieldLabel>
                    <FieldControl>
                      <Textarea
                        rows={8}
                        value={field.state.value}
                        disabled={fieldsDisabled}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        placeholder="What changed and why…"
                      />
                    </FieldControl>
                  </Field>
                )}
              </form.Field>
              <form.Field name="branch">
                {(field) => (
                  <Field
                    hint={
                      branchLocked
                        ? "The published PR keeps its branch."
                        : "Remote branch the PR ships as; empty keeps the run branch."
                    }
                  >
                    <FieldLabel>Branch</FieldLabel>
                    <FieldControl>
                      <Input
                        value={field.state.value}
                        disabled={fieldsDisabled || branchLocked}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        placeholder={branch ?? "feat/short-name"}
                        spellCheck={false}
                      />
                    </FieldControl>
                  </Field>
                )}
              </form.Field>
              <form.Field name="mode">
                {(field) => (
                  <PullRequestModeField
                    value={field.state.value}
                    disabled={fieldsDisabled}
                    onChange={field.handleChange}
                  />
                )}
              </form.Field>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={!canSubmit || model.actionDisabled || terminal}
                  loading={isPending || model.actionPending}
                >
                  {model.actionLabel}
                </Button>
              </div>
            </>
          );
        }}
      </form.Subscribe>
    </form>
  );
}
