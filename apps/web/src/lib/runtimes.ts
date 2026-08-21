import type { RuntimeDescriptor } from "@otomat/domain";
import type { ProviderMarkName } from "@otomat/ui";

/** Which provider a runtime speaks to, so its rows carry that provider's mark. Unknown runtimes stay unmarked rather than borrowing someone else's logo. */
const RUNTIME_MARKS = new Map<string, ProviderMarkName>([
  ["claude", "claude"],
  ["codex", "openai"],
]);

export function runtimeMark(runtimeId: string | null): ProviderMarkName | null {
  return runtimeId === null ? null : (RUNTIME_MARKS.get(runtimeId) ?? null);
}

export function runtimeById(
  descriptors: RuntimeDescriptor[],
  runtimeId: string,
): RuntimeDescriptor | undefined {
  return descriptors.find((descriptor) => descriptor.id === runtimeId);
}

export function isAvailableRuntime(descriptor: RuntimeDescriptor): boolean {
  return descriptor.availability.status === "available";
}

export function isRealRuntime(descriptor: RuntimeDescriptor): boolean {
  return descriptor.kind === "real";
}

/** The runtime a launch should use: the still-available choice, else an available real runtime, else any available one — the daemon lists a simulated runtime only under an explicit opt-in. */
export function resolveRuntimeChoice(
  descriptors: RuntimeDescriptor[],
  preferred: string | null,
): string | null {
  const chosen = descriptors.find((descriptor) => descriptor.id === preferred);
  if (chosen && isAvailableRuntime(chosen)) return chosen.id;
  const real = descriptors.find((d) => isRealRuntime(d) && isAvailableRuntime(d));
  return (real ?? descriptors.find(isAvailableRuntime))?.id ?? null;
}

export const SIMULATED_RUNTIME_NOTE =
  "Simulation drives the real run pipeline without contacting a model: it records the prompt instead of implementing it.";

export function hasLaunchableRuntime(descriptors: RuntimeDescriptor[]): boolean {
  return descriptors.some(isAvailableRuntime);
}
