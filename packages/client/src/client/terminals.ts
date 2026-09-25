import {
  terminalInventorySchema,
  terminalOutputSchema,
  terminalPreviewSchema,
  terminalSessionSchema,
  type TerminalOpenRequest,
  type TerminalTool,
} from "@otomat/domain";

import type { DaemonClientConfig } from "./config.js";
import { getJson, postJson, queryString } from "./http.js";

export function createTerminalClient(config: DaemonClientConfig) {
  return {
    async listTerminals() {
      return terminalInventorySchema.parse(await getJson(config, "/api/terminals"));
    },
    async openTerminal(input: TerminalOpenRequest) {
      return terminalSessionSchema.parse(await postJson(config, "/api/terminals", input));
    },
    async terminalPreview(issueId: string, tool: TerminalTool) {
      return terminalPreviewSchema.parse(
        await getJson(
          config,
          `/api/terminals/context/${encodeURIComponent(issueId)}${queryString({ tool })}`,
        ),
      );
    },
    async terminalOutput(id: string, instance: string, after: number) {
      return terminalOutputSchema.parse(
        await getJson(
          config,
          `/api/terminals/${encodeURIComponent(id)}/output${queryString({ instance, after: String(after) })}`,
        ),
      );
    },
    async writeTerminal(id: string, instance: string, data: string) {
      await postJson(config, `/api/terminals/${encodeURIComponent(id)}/input`, { instance, data });
    },
    async resizeTerminal(id: string, instance: string, cols: number, rows: number) {
      await postJson(config, `/api/terminals/${encodeURIComponent(id)}/resize`, {
        instance,
        cols,
        rows,
      });
    },
    async closeTerminal(id: string, instance: string) {
      await postJson(config, `/api/terminals/${encodeURIComponent(id)}/close`, { instance });
    },
  };
}
