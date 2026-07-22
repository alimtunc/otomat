import { githubConnectionContractSchema } from "@otomat/domain";

import type { DaemonClientConfig } from "./config.js";
import { getJson, postJson } from "./http.js";

export function createGitHubClient(config: DaemonClientConfig) {
  return {
    async getGitHubConnection() {
      return githubConnectionContractSchema.parse(await getJson(config, "/api/github/connection"));
    },
    async connectGitHub() {
      return githubConnectionContractSchema.parse(
        await postJson(config, "/api/github/connect", {}),
      );
    },
  };
}
