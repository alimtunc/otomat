import type { Db } from "@otomat/db";

import { agentConfigRefusal, type AgentConfigRefusal } from "./refusal.js";
import { resolveAgentConfig } from "./resolve.js";

export function agentProfileCompatibility(db: Db, profileId: string): AgentConfigRefusal | null {
  try {
    resolveAgentConfig(db, { kind: "profile", profileId });
    return null;
  } catch (error) {
    const refusal = agentConfigRefusal(error);
    if (refusal === null) throw error;
    return refusal;
  }
}
