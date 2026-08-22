import { createActivityClient } from "./activity.js";
import { createAgentsClient } from "./agents.js";
import type { DaemonClientConfig } from "./config.js";
import {
  subscribeRunEvents,
  type RunEventsHandlers,
  type RunEventsSubscription,
} from "./events.js";
import { createGitHubClient } from "./github.js";
import { createInboxClient } from "./inbox.js";
import { createIssuesClient } from "./issues.js";
import { createLinearClient } from "./linear.js";
import { createPullRequestsClient } from "./pull-requests.js";
import { createReviewsClient } from "./reviews.js";
import { createRunsClient } from "./runs.js";
import { createSystemClient } from "./system.js";
import { createUsageClient } from "./usage.js";
import { createWorkflowPresetsClient } from "./workflow-presets.js";
import { createWorkspaceClient } from "./workspace.js";

export function createDaemonClient(config: DaemonClientConfig = {}) {
  return {
    ...createSystemClient(config),
    ...createActivityClient(config),
    ...createWorkspaceClient(config),
    ...createGitHubClient(config),
    ...createLinearClient(config),
    ...createAgentsClient(config),
    ...createInboxClient(config),
    ...createIssuesClient(config),
    ...createRunsClient(config),
    ...createReviewsClient(config),
    ...createPullRequestsClient(config),
    ...createUsageClient(config),
    ...createWorkflowPresetsClient(config),
    subscribeRunEvents(runId: string, handlers: RunEventsHandlers): RunEventsSubscription {
      return subscribeRunEvents(config, runId, handlers);
    },
  };
}

export type DaemonClient = ReturnType<typeof createDaemonClient>;
