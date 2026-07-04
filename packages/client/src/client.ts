import {
  healthResponseSchema,
  issueContractSchema,
  projectContractSchema,
  repositoryContractSchema,
  runContractSchema,
  runDetailSchema,
  type StartRunRequest,
} from "@otomat/domain";

import { getJson, postJson, queryString } from "./http";
import { subscribeRunEvents } from "./sse";
import type { DaemonClientConfig, RunEventsHandlers, RunEventsSubscription } from "./types";

export function createDaemonClient(config: DaemonClientConfig = {}) {
  return {
    async health() {
      return healthResponseSchema.parse(await getJson(config, "/api/health"));
    },
    async listProjects() {
      return projectContractSchema.array().parse(await getJson(config, "/api/projects"));
    },
    async listRepositories(params: { projectId?: string } = {}) {
      return repositoryContractSchema
        .array()
        .parse(await getJson(config, `/api/repositories${queryString(params)}`));
    },
    async listIssues(params: { projectId?: string } = {}) {
      return issueContractSchema
        .array()
        .parse(await getJson(config, `/api/issues${queryString(params)}`));
    },
    async getIssue(id: string) {
      return issueContractSchema.parse(
        await getJson(config, `/api/issues/${encodeURIComponent(id)}`),
      );
    },
    async listRuns(params: { issueId?: string } = {}) {
      return runContractSchema
        .array()
        .parse(await getJson(config, `/api/runs${queryString(params)}`));
    },
    async getRun(id: string) {
      return runDetailSchema.parse(await getJson(config, `/api/runs/${encodeURIComponent(id)}`));
    },
    async startRun(request: StartRunRequest) {
      return runContractSchema.parse(await postJson(config, "/api/runs", request));
    },
    async resumeRun(id: string) {
      return runContractSchema.parse(
        await postJson(config, `/api/runs/${encodeURIComponent(id)}/resume`, {}),
      );
    },
    async abortRun(id: string) {
      return runDetailSchema.parse(
        await postJson(config, `/api/runs/${encodeURIComponent(id)}/abort`, {}),
      );
    },
    subscribeRunEvents(runId: string, handlers: RunEventsHandlers): RunEventsSubscription {
      return subscribeRunEvents(config, runId, handlers);
    },
  };
}

export type DaemonClient = ReturnType<typeof createDaemonClient>;
