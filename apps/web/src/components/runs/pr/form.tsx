import { COMMIT_SUBJECT_MAX_LENGTH } from "@otomat/domain";
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
  Spinner,
  Textarea,
} from "@otomat/ui";
import { PullRequestBranchField } from "@web/components/runs/pr/branch-field";
import { PullRequestModeField } from "@web/components/runs/pr/mode-field";
import { PullRequestSubjectFields } from "@web/components/runs/pr/subject-fields";
import { PullRequestSummary } from "@web/components/runs/pr/summary";
import { usePullRequestForm } from "@web/components/runs/pr/use-form";

import { firstDraftError, subjectLength } from "./draft-state";
import { generationBlocked, isPublished, publicationModel } from "./publication-model";

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

  const branchLocked = isPublished(pullRequest);

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
          const { summary } = values;
          const draftError = firstDraftError(fieldMeta, errors);
          const blocked = generationBlocked(publishability);
          const model = publicationModel({
            pullRequest,
            operation,
            publishability,
            connected,
            hasDraftChanges: isDirty,
          });
          const publishing = isPending || model.actionPending;
          const busy = publishing || isGenerating;
          const refusal = summary.trim() === "" ? generationRefusal : null;
          const showDetails = customize || refusal !== null;
          // Without metadata the daemon writes it as the publication's first phase: the empty form is never validated.
          const composeWithAi = !showDetails && !branchLocked && summary.trim() === "";
          return (
            <>
              <PullRequestSummary
                publishability={publishability}
                status={model.status}
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
              <Collapsible open={showDetails} onOpenChange={onCustomizeChange}>
                <CollapsibleTrigger
                  render={
                    <Button type="button" variant="ghost" size="sm">
                      {showDetails ? "Hide PR details" : "Customize PR"}
                      {draftError ? (
                        <Chip tone="warning">
                          {subjectLength(values) > COMMIT_SUBJECT_MAX_LENGTH
                            ? `Subject ${subjectLength(values)} / ${COMMIT_SUBJECT_MAX_LENGTH} — shorten`
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
              <div className="flex flex-wrap items-center justify-end gap-2">
                {showDetails && blocked ? (
                  <p className="text-xs text-text-tertiary">
                    Generation needs an available workspace, its GitHub remote and changes to
                    describe.
                  </p>
                ) : null}
                {showDetails ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void generateOnly()}
                    loading={isGenerating}
                    disabled={busy || blocked}
                  >
                    Generate title &amp; description with AI
                  </Button>
                ) : null}
                <Button
                  type={composeWithAi ? "button" : "submit"}
                  variant="primary"
                  size="sm"
                  onClick={composeWithAi ? () => void onSubmit({ mode: values.mode }) : undefined}
                  disabled={(!composeWithAi && !canSubmit) || model.actionDisabled || busy}
                  aria-busy={publishing || undefined}
                >
                  {publishing ? <Spinner size={12} aria-hidden /> : null}
                  {composeWithAi ? "Generate PR" : model.actionLabel}
                </Button>
              </div>
            </>
          );
        }}
      </form.Subscribe>
    </form>
  );
}
