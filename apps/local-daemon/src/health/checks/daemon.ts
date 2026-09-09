import type { ProjectHealthOutcome } from "@otomat/domain";

export interface DaemonIdentity {
  name: string;
  version: string;
  build: string | null;
}

/** Reaching this code proves the host answered; an unreachable host never produces a report at all. */
export function daemonCheck(identity: DaemonIdentity): ProjectHealthOutcome {
  const build = identity.build === null ? "" : ` (build ${identity.build})`;
  return {
    status: "ready",
    message: `${identity.name} ${identity.version}${build} answered on this host.`,
    remediation: null,
  };
}
