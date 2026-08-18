import {
  COMMIT_TYPES,
  parseCommitSubject,
  type CommitType,
  type PreparePullRequestRequest,
  type PullRequestContract,
  type PullRequestPublicationMode,
} from "@otomat/domain";
import { useForm } from "@tanstack/react-form";

import { initialPublicationMode } from "./model";

export interface PullRequestFormOptions {
  pullRequest: PullRequestContract | null;
  chosenMode: PullRequestPublicationMode | undefined;
  onSubmit: (value: PreparePullRequestRequest) => Promise<boolean>;
}

const [DEFAULT_TYPE] = COMMIT_TYPES;

function subjectDefaults(pullRequest: PullRequestContract | null): {
  type: CommitType;
  scope: string;
  summary: string;
} {
  const stored = parseCommitSubject(pullRequest?.commit_subject ?? "");
  if (stored === null) return { type: DEFAULT_TYPE, scope: "", summary: "" };
  return { type: stored.type, scope: stored.scope ?? "", summary: stored.summary };
}

export function usePullRequestForm({ pullRequest, chosenMode, onSubmit }: PullRequestFormOptions) {
  return useForm({
    defaultValues: {
      ...subjectDefaults(pullRequest),
      body: pullRequest?.body ?? "",
      branch: pullRequest?.head_ref ?? "",
      mode: initialPublicationMode(pullRequest, chosenMode),
    },
    onSubmit: async ({ value, formApi }) => {
      const headRef = value.branch.trim();
      const scope = value.scope.trim();
      const submitted: PreparePullRequestRequest = {
        subject: {
          type: value.type,
          scope: scope === "" ? null : scope,
          summary: value.summary.trim(),
        },
        body: value.body,
        mode: value.mode,
        ...(headRef === "" ? {} : { head_ref: headRef }),
      };
      if (await onSubmit(submitted)) {
        formApi.reset({
          ...value,
          scope: submitted.subject.scope ?? "",
          summary: submitted.subject.summary,
        });
      }
    },
  });
}

export type PullRequestFormApi = ReturnType<typeof usePullRequestForm>;
