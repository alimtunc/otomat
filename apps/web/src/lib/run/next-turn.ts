import type { RuntimeResumeModelCapability } from "@otomat/domain";

export function nextTurnRefusal(
  capability: RuntimeResumeModelCapability | undefined,
  runtimesPending: boolean,
  runtimesError: boolean,
  providerSessionId: string | null,
): string | null {
  if (capability === undefined) {
    if (runtimesPending) return "Checking model support…";
    return runtimesError
      ? "Could not read the daemon's runtimes, so model support is unknown."
      : "This step's runtime is not registered on the daemon.";
  }
  if (capability.status === "unsupported") {
    return `${capability.reason} Add a follow-up step to use another model.`;
  }
  if (providerSessionId === null) {
    return "This step has no provider session to resume, so its next turn keeps the step's configuration.";
  }
  return null;
}
