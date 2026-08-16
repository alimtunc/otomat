import type { IssueContract } from "@otomat/domain";

/** What a node's context composer attaches and searches; null on a surface that attaches none. */
export interface WorkflowContextScope {
  /** The issue Otomat attaches on its own; null while the run that creates it does not exist yet. */
  issue: IssueContract | null;
  projectId: string;
}
