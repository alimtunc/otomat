import {
  COMMIT_TYPES,
  parseCommitSubject,
  type CommitType,
  type PublishPullRequestRequest,
  type PullRequestPublicationDetails,
  type PullRequestContract,
  type PullRequestPublicationMode,
} from "@otomat/domain";
import { useForm } from "@tanstack/react-form";

import { initialPublicationMode } from "./model";

export interface PullRequestFormOptions {
  pullRequest: PullRequestContract | null;
  chosenMode: PullRequestPublicationMode | undefined;
  onSubmit: (request: PublishPullRequestRequest) => Promise<boolean>;
}

const [DEFAULT_TYPE] = COMMIT_TYPES;

interface SubjectDefaults {
  type: CommitType;
  scope: string;
  summary: string;
}

function subjectDefaults(pullRequest: PullRequestContract | null): SubjectDefaults {
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
      const details: PullRequestPublicationDetails = {
        subject: {
          type: value.type,
          scope: scope === "" ? null : scope,
          summary: value.summary.trim(),
        },
        body: value.body,
      };
      if (headRef !== "") details.head_ref = headRef;
      if (await onSubmit({ mode: value.mode, details })) {
        formApi.reset({
          ...value,
          scope: details.subject.scope ?? "",
          summary: details.subject.summary,
        });
      }
    },
  });
}

export type PullRequestFormApi = ReturnType<typeof usePullRequestForm>;
