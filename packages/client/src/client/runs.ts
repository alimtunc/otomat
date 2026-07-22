import {
  runContractSchema,
  runDetailSchema,
  runDiffResponseSchema,
  type FollowUpRunRequest,
  type SelectCompeteWinnerRequest,
  type StartRunRequest,
} from "@otomat/domain";

import type { DaemonClientConfig } from "./config.js";
import { getJson, postJson, queryString } from "./http.js";

export function createRunsClient(config: DaemonClientConfig) {
  return {
    async listRuns(params: { issueId?: string; projectId?: string } = {}) {
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
    async followUpRun(id: string, request: FollowUpRunRequest) {
      return runContractSchema.parse(
        await postJson(config, `/api/runs/${encodeURIComponent(id)}/follow-up`, request),
      );
    },
    async abortRun(id: string) {
      return runDetailSchema.parse(
        await postJson(config, `/api/runs/${encodeURIComponent(id)}/abort`, {}),
      );
    },
    async getCompeteCandidateDiff(id: string, groupId: string, stepId: string) {
      return runDiffResponseSchema.parse(
        await getJson(
          config,
          `/api/runs/${encodeURIComponent(id)}/compete-groups/${encodeURIComponent(groupId)}/candidates/${encodeURIComponent(stepId)}/diff`,
        ),
      );
    },
    async selectCompeteWinner(id: string, groupId: string, request: SelectCompeteWinnerRequest) {
      return runDetailSchema.parse(
        await postJson(
          config,
          `/api/runs/${encodeURIComponent(id)}/compete-groups/${encodeURIComponent(groupId)}/winner`,
          request,
        ),
      );
    },
    async getRunDiff(id: string) {
      return runDiffResponseSchema.parse(
        await getJson(config, `/api/runs/${encodeURIComponent(id)}/diff`),
      );
    },
  };
}
