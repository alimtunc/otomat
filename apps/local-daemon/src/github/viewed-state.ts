export const VIEWER_VIEWED_STATES = ["VIEWED", "UNVIEWED", "DISMISSED"] as const;

export type ViewerViewedState = (typeof VIEWER_VIEWED_STATES)[number];

export interface PullRequestViewedFile {
  path: string;
  state: ViewerViewedState;
}

export interface PullRequestViewedFiles {
  /** Read in the same call as the states, so the id and the answer describe one pull request. */
  nodeId: string;
  files: PullRequestViewedFile[];
}
