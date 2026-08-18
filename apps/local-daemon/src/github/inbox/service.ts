import type { PullRequestInbox } from "@otomat/domain";

import type { PullRequestImportConfig } from "../import/service.js";
import { PullRequestSyncPasses } from "./passes.js";
import { readPullRequestInbox } from "./read.js";
import { syncProjectPullRequests } from "./sync.js";

export interface PullRequestInboxService {
  read(projectId: string): PullRequestInbox;
  sync(projectId: string): Promise<PullRequestInbox>;
}

export function createPullRequestInboxService(
  config: PullRequestImportConfig,
): PullRequestInboxService {
  const passes = new PullRequestSyncPasses();
  const context = { db: config.db, passes };
  return {
    read: (projectId) => readPullRequestInbox(context, projectId),
    async sync(projectId) {
      await passes.pass(projectId, () => syncProjectPullRequests(config, projectId));
      return readPullRequestInbox(context, projectId);
    },
  };
}
