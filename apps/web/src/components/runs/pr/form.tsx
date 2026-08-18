import type {
  PreparePullRequestRequest,
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
  Input,
  Textarea,
} from "@otomat/ui";
import { PullRequestActions } from "@web/components/runs/pr/actions";
import { PullRequestModeField } from "@web/components/runs/pr/mode-field";
import { PullRequestSubjectFields } from "@web/components/runs/pr/subject-fields";
import { usePullRequestForm } from "@web/components/runs/pr/use-form";

import { publicationModel } from "./publication-model";

export interface PullRequestFormProps {
  pullRequest: PullRequestContract | null;
  publishability: PullRequestPublishability;
  connected: boolean;
  /** Advanced fields revealed; owned by the route so it survives a reload. */
  customize: boolean;
  onCustomizeChange: (customize: boolean) => void;
  /** The explicit Draft/Ready choice the route already carries, or undefined for a new publication. */
  chosenMode: PullRequestPublicationMode | undefined;
  onModeChange: (mode: PullRequestPublicationMode) => void;
  onSubmit: (value: PreparePullRequestRequest) => Promise<boolean>;
  /** Writes the metadata with the configured agent; null when it failed (the mutation owns the toast). */
  onGenerate: () => Promise<PullRequestProposal | null>;
  isPending: boolean;
  isGenerating: boolean;
}

function aiActionLabel(mode: PullRequestPublicationMode): string {
  return mode === "draft" ? "Create draft PR with AI" : "Create PR with AI";
}

export function PullRequestForm({
  pullRequest,
  publishability,
  connected,
  customize,
  onCustomizeChange,
  chosenMode,
  onModeChange,
  onSubmit,
  onGenerate,
  isPending,
  isGenerating,
}: PullRequestFormProps) {
  const form = usePullRequestForm({ pullRequest, chosenMode, onSubmit });

  const terminal = pullRequest?.status === "merged" || pullRequest?.status === "closed";
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

  /** One operation, and a generation that failed publishes nothing while every field stays editable. */
  const createWithAi = async (mode: PullRequestPublicationMode): Promise<void> => {
    const proposal = await onGenerate();
    if (proposal === null) return;
    fillFrom(proposal);
    const accepted = await onSubmit({
      subject: proposal.subject,
      body: proposal.body,
      head_ref: proposal.branch,
      mode,
    });
    if (accepted) {
      form.reset({
        type: proposal.subject.type,
        scope: proposal.subject.scope ?? "",
        summary: proposal.subject.summary,
        body: proposal.body,
        branch: proposal.branch,
        mode,
      });
    }
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
        selector={(state) => [state.canSubmit, state.isDirty, state.values.mode] as const}
      >
        {([canSubmit, isDirty, mode]) => {
          const model = publicationModel(pullRequest, publishability, connected, isDirty, mode);
          const busy = model.actionPending || isPending || isGenerating;
          const fieldsDisabled = terminal || busy;
          const composeWithAi = !branchLocked && !customize;
          return (
            <>
              <Chip>{model.stateLabel}</Chip>
              <Collapsible open={customize} onOpenChange={onCustomizeChange}>
                <CollapsibleTrigger
                  render={
                    <Button type="button" variant="ghost" size="sm">
                      {customize ? "Hide PR details" : "Customize PR"}
                    </Button>
                  }
                />
                <CollapsiblePanel className="flex flex-col gap-4 pt-4">
                  <PullRequestSubjectFields form={form} disabled={fieldsDisabled} />
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
                            placeholder={publishability.head_ref ?? "feat/short-name"}
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
                        onChange={(next) => {
                          field.handleChange(next);
                          onModeChange(next);
                        }}
                      />
                    )}
                  </form.Field>
                </CollapsiblePanel>
              </Collapsible>
              <PullRequestActions
                primaryLabel={composeWithAi ? aiActionLabel(mode) : model.actionLabel}
                primaryDisabled={
                  (!composeWithAi && !canSubmit) || model.actionDisabled || terminal || isGenerating
                }
                primaryLoading={composeWithAi ? busy : isPending || model.actionPending}
                onCompose={composeWithAi ? () => void createWithAi(mode) : null}
                onGenerate={() => void generateOnly()}
                generateDisabled={fieldsDisabled}
                isGenerating={isGenerating}
              />
            </>
          );
        }}
      </form.Subscribe>
    </form>
  );
}
