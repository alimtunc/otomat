import type {
  GitHubConnectionContract,
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
import { fieldErrorProps } from "@web/lib/form";

import { pullRequestViewModel } from "./model";

interface PullRequestFormProps {
  pullRequest: PullRequestContract | null;
  branch: string | null;
  connection: GitHubConnectionContract;
  onSubmit: (value: { title: string; body: string; head_ref?: string }) => Promise<boolean>;
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
    },
    onSubmit: async ({ value, formApi }) => {
      const headRef = value.branch.trim();
      const submitted = {
        title: value.title.trim(),
        body: value.body,
        ...(headRef === "" ? {} : { head_ref: headRef }),
      };
      if (await onSubmit(submitted)) formApi.reset({ ...value, title: submitted.title });
    },
  });

  const terminal = pullRequest?.status === "merged" || pullRequest?.status === "closed";
  // Once the PR exists on GitHub its head branch is its identity; only a first publish may rename.
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
      <form.Subscribe selector={(state) => [state.canSubmit, state.isDirty] as const}>
        {([canSubmit, isDirty]) => {
          const model = pullRequestViewModel(connection, pullRequest, canPublish, isDirty);
          // actionPending never depends on hasDraftChanges, so fieldsDisabled matches the pre-isDirty value.
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
              <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-2 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{model.connectionLabel}</p>
                  {model.deviceAuthorization ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Enter code{" "}
                      <code className="font-mono font-semibold text-foreground">
                        {model.deviceAuthorization.code}
                      </code>{" "}
                      at{" "}
                      <a
                        className="underline"
                        href={model.deviceAuthorization.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {model.deviceAuthorization.url}
                      </a>
                    </p>
                  ) : null}
                  {model.errorMessage ? (
                    <p className="mt-1 text-xs text-danger">{model.errorMessage}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {model.linkUrl && model.linkLabel ? (
                    <Button
                      render={
                        <a href={model.linkUrl} target="_blank" rel="noreferrer">
                          {model.linkLabel}
                        </a>
                      }
                      variant="outline"
                      size="sm"
                    />
                  ) : null}
                  {model.showConnect ? (
                    <Button type="button" size="sm" onClick={onConnect} loading={isConnecting}>
                      Connect GitHub
                    </Button>
                  ) : null}
                </div>
              </div>
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
