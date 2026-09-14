import { COMMIT_SUBJECT_MAX_LENGTH, formatCommitSubject } from "@otomat/domain";
import type {
  OperationContract,
  PublishPullRequestRequest,
  PullRequestContract,
  PullRequestProposal,
  PullRequestPublicationMode,
  PullRequestPublishability,
} from "@otomat/domain";
import {
  Button,
  Chip,
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
  Field,
  FieldControl,
  FieldLabel,
  Textarea,
} from "@otomat/ui";
import { PullRequestActions } from "@web/components/runs/pr/actions";
import { PullRequestBranchField } from "@web/components/runs/pr/branch-field";
import { PullRequestModeField } from "@web/components/runs/pr/mode-field";
import { PullRequestSubjectFields } from "@web/components/runs/pr/subject-fields";
import { PullRequestSummary } from "@web/components/runs/pr/summary";
import { usePullRequestForm } from "@web/components/runs/pr/use-form";

import { publicationModel } from "./publication-model";

export interface PullRequestFormProps {
  pullRequest: PullRequestContract | null;
  operation: OperationContract | null;
  publishability: PullRequestPublishability;
  connected: boolean;
  connectionLabel?: string;
  customize: boolean;
  onCustomizeChange: (customize: boolean) => void;
  chosenMode: PullRequestPublicationMode | undefined;
  onModeChange: (mode: PullRequestPublicationMode) => void;
  onSubmit: (request: PublishPullRequestRequest) => Promise<boolean>;
  onGenerate: () => Promise<PullRequestProposal | null>;
  generationRefusal: string | null;
  isPending: boolean;
  isGenerating: boolean;
}

function aiActionLabel(mode: PullRequestPublicationMode): string {
  return mode === "draft" ? "Create draft PR with AI" : "Create PR with AI";
}

export function PullRequestForm({
  pullRequest,
  operation,
  publishability,
  connected,
  connectionLabel,
  customize,
  onCustomizeChange,
  chosenMode,
  onModeChange,
  onSubmit,
  onGenerate,
  generationRefusal,
  isPending,
  isGenerating,
}: PullRequestFormProps) {
  const form = usePullRequestForm({ pullRequest, chosenMode, onSubmit });

  const branchLocked = pullRequest?.number !== null && pullRequest?.number !== undefined;

  const fillFrom = (proposal: PullRequestProposal): void => {
    form.setFieldValue("type", proposal.subject.type);
    form.setFieldValue("scope", proposal.subject.scope ?? "");
    form.setFieldValue("summary", proposal.subject.summary);
    form.setFieldValue("body", proposal.body);
    if (!branchLocked) form.setFieldValue("branch", proposal.branch);
  };

  const generateOnly = async (): Promise<void> => {
    const proposal = await onGenerate();
    if (proposal !== null) fillFrom(proposal);
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Subscribe
        selector={(state) =>
          [state.canSubmit, state.isDirty, state.values, state.errors, state.fieldMeta] as const
        }
      >
        {([canSubmit, isDirty, values, errors, fieldMeta]) => {
          const { mode, summary } = values;
          const metadataDirty =
            fieldMeta.type?.isDirty ||
            fieldMeta.scope?.isDirty ||
            fieldMeta.summary?.isDirty ||
            fieldMeta.body?.isDirty ||
            fieldMeta.branch?.isDirty;
          const draftError =
            Object.values(fieldMeta)
              .flatMap((meta) => meta?.errors ?? [])
              .find((error) => typeof error === "string") ??
            errors.find((error) => typeof error === "string");
          const subjectLength = formatCommitSubject({
            type: values.type,
            scope: values.scope.trim() || null,
            summary,
          }).length;
          const generationBlocked =
            publishability.blocker?.code === "worktree_missing" ||
            publishability.blocker?.code === "remote_missing" ||
            publishability.changed_files === 0;

          const model = publicationModel({
            pullRequest,
            operation,
            publishability,
            connected,
            hasDraftChanges: isDirty,
            mode,
          });
          const busy = model.actionPending || isPending || isGenerating;
          let publicationStatus = branchLocked ? "Published" : "Not published";
          if (model.actionPending) publicationStatus = "Publishing";
          const refusal = summary.trim() === "" ? generationRefusal : null;
          const showDetails = customize || refusal !== null;
          // Metadata already written is republished as it stands: a retry never pays the generator twice.
          const composeWithAi =
            !branchLocked && !showDetails && !metadataDirty && pullRequest?.commit_subject == null;
          return (
            <>
              <PullRequestSummary
                publishability={publishability}
                status={publicationStatus}
                stateLabel={model.stateLabel}
                connectionLabel={connectionLabel}
                mode={
                  <form.Field name="mode">
                    {(field) => (
                      <PullRequestModeField
                        value={field.state.value}
                        disabled={busy}
                        onChange={(next) => {
                          field.handleChange(next);
                          onModeChange(next);
                        }}
                      />
                    )}
                  </form.Field>
                }
              />
              {publishability.blocker ? (
                <p className="text-xs text-text-tertiary">Mode kept for a later publication.</p>
              ) : null}
              <PullRequestActions
                primaryLabel={composeWithAi ? aiActionLabel(mode) : model.actionLabel}
                primaryDisabled={
                  (!composeWithAi && !canSubmit) || model.actionDisabled || isGenerating
                }
                primaryLoading={composeWithAi ? busy : isPending || model.actionPending}
                onCompose={composeWithAi ? () => void onSubmit({ mode }) : null}
                onGenerate={() => void generateOnly()}
                generateDisabled={busy || generationBlocked}
                isGenerating={isGenerating}
              />
              {generationBlocked ? (
                <p className="text-xs text-text-tertiary">
                  Generation needs an available workspace, its GitHub remote and changes to
                  describe.
                </p>
              ) : null}
              <Collapsible open={showDetails} onOpenChange={onCustomizeChange}>
                <CollapsibleTrigger
                  render={
                    <Button type="button" variant="ghost" size="sm">
                      {showDetails ? "Hide PR details" : "Customize PR"}
                      {draftError ? (
                        <Chip tone="warning">
                          {subjectLength > COMMIT_SUBJECT_MAX_LENGTH
                            ? `Subject ${subjectLength} / ${COMMIT_SUBJECT_MAX_LENGTH} — shorten`
                            : draftError}
                        </Chip>
                      ) : null}
                    </Button>
                  }
                />
                <CollapsiblePanel keepMounted className="flex flex-col gap-4 pt-4">
                  <PullRequestSubjectFields
                    form={form}
                    disabled={busy}
                    generationRefusal={refusal}
                  />
                  <form.Field name="body">
                    {(field) => (
                      <Field hint="Optional description shown on GitHub.">
                        <FieldLabel>Description</FieldLabel>
                        <FieldControl>
                          <Textarea
                            rows={8}
                            value={field.state.value}
                            disabled={busy}
                            onBlur={field.handleBlur}
                            onChange={(event) => field.handleChange(event.target.value)}
                            placeholder="What changed and why…"
                          />
                        </FieldControl>
                      </Field>
                    )}
                  </form.Field>
                  <PullRequestBranchField
                    form={form}
                    disabled={busy}
                    branchLocked={branchLocked}
                    headRef={publishability.head_ref}
                  />
                </CollapsiblePanel>
              </Collapsible>
            </>
          );
        }}
      </form.Subscribe>
    </form>
  );
}
