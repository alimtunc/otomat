import { listAgentProfiles, listSkills, type AgentProfileRow, type Db } from "@otomat/db";
import { isSkillInScope, type ProjectHealthOutcome } from "@otomat/domain";

import { agentConfigRefusal, resolveAgentConfig } from "#agents";

/** Resolves each profile exactly as a launch would and throws the result away; nothing is frozen here. */
function profileRefusals(db: Db, profiles: AgentProfileRow[]): string[] {
  return profiles.flatMap((profile) => {
    try {
      resolveAgentConfig(db, { kind: "profile", profileId: profile.id });
      return [];
    } catch (error) {
      const refusal = agentConfigRefusal(error);
      if (refusal === null) throw error;
      return [`"${profile.name}": ${refusal.message}`];
    }
  });
}

export function agentsCheck(db: Db, projectId: string): ProjectHealthOutcome {
  const profiles = listAgentProfiles(db, projectId);
  const refusals = profileRefusals(db, profiles);
  if (refusals.length > 0) {
    return {
      status: "error",
      message: `${refusals.length} of ${profiles.length} profile(s) cannot be resolved here — ${refusals.join("; ")}.`,
      remediation:
        "Fix the profile's runtime, model or skills on this host, then re-run the check.",
    };
  }

  const broken = listSkills(db).filter(
    (skill) => skill.status !== "available" && isSkillInScope(skill.project_id, projectId),
  );
  if (broken.length > 0) {
    return {
      status: "warning",
      message: `${broken.length} discovered skill(s) cannot be activated on this host.`,
      remediation: "Re-scan skills on this host, or remove the skills whose files are gone.",
    };
  }

  return {
    status: "ready",
    message:
      profiles.length === 0
        ? "No agent profile is defined here; runs pick their runtime at launch."
        : `${profiles.length} agent profile(s) resolve on this host with their skills.`,
    remediation: null,
  };
}
