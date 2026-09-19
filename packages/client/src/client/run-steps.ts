import {
  stepEventWindowSchema,
  stepRunContractSchema,
  type OverrideStepDeliveryRequest,
  type SetNextTurnModelRequest,
} from "@otomat/domain";

import type { DaemonClientConfig } from "./config.js";
import { getJson, postJson, queryString } from "./http.js";

function stepPath(id: string, stepId: string, suffix: string): string {
  return `/api/runs/${encodeURIComponent(id)}/steps/${encodeURIComponent(stepId)}/${suffix}`;
}

export function createRunStepsClient(config: DaemonClientConfig) {
  const postStep = async (id: string, stepId: string, suffix: string, body: unknown) =>
    stepRunContractSchema.parse(await postJson(config, stepPath(id, stepId, suffix), body));
  return {
    async getStepEventWindow(
      id: string,
      stepId: string,
      params: { before?: number; limit?: number } = {},
    ) {
      const query = queryString({
        before: params.before?.toString(),
        limit: params.limit?.toString(),
      });
      return stepEventWindowSchema.parse(
        await getJson(config, `${stepPath(id, stepId, "events/window")}${query}`),
      );
    },
    stopRunStep(id: string, stepId: string) {
      return postStep(id, stepId, "stop", {});
    },
    cancelRunStep(id: string, stepId: string) {
      return postStep(id, stepId, "cancel", {});
    },
    overrideStepDelivery(id: string, stepId: string, request: OverrideStepDeliveryRequest) {
      return postStep(id, stepId, "override-delivery", request);
    },
    setNextTurnModel(id: string, stepId: string, request: SetNextTurnModelRequest) {
      return postStep(id, stepId, "model", request);
    },
  };
}
