import { readExecutionDefaults, type Db } from "@otomat/db";
import type { ProjectHealthOutcome, RuntimeDescriptor } from "@otomat/domain";

import { listRuntimeDescriptors } from "#runtime";

const UNAVAILABLE_REMEDIATION =
  "Install the provider CLI on this host and make it reachable on the daemon's PATH.";

function names(runtimes: RuntimeDescriptor[]): string {
  return runtimes.map((runtime) => runtime.display_name).join(", ");
}

/** A detected CLI is as far as a non-destructive probe reaches; whether its account is still signed in is only learned by running a turn. */
export function runtimesCheck(db: Db, env?: NodeJS.ProcessEnv): ProjectHealthOutcome {
  const descriptors = listRuntimeDescriptors(env);
  const available = descriptors.filter((runtime) => runtime.availability.status === "available");
  const missing = descriptors.filter((runtime) => runtime.availability.status !== "available");

  if (available.length === 0) {
    return {
      status: "error",
      message: `No agent CLI was detected on this host (${names(missing)} missing).`,
      remediation: UNAVAILABLE_REMEDIATION,
    };
  }

  const fallback = readExecutionDefaults(db).runtime;
  const fallbackDescriptor = descriptors.find((runtime) => runtime.id === fallback);
  if (fallback !== null && fallbackDescriptor?.availability.status !== "available") {
    return {
      status: "error",
      message: `This host's default runtime "${fallback}" is not usable here; detected: ${names(available)}.`,
      remediation: `${UNAVAILABLE_REMEDIATION} Or pick another default runtime for this host.`,
    };
  }

  const undetected = missing.length === 0 ? "" : ` Not detected: ${names(missing)}.`;
  return {
    status: "ready",
    message: `Detected on this host: ${names(available)}.${undetected}`,
    remediation: null,
  };
}
