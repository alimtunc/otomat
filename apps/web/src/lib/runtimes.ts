import type { RuntimeDescriptor } from "@otomat/domain";

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

/**
 * The runtime a launch should use: the user's choice while it is still listed
 * and available, else the first available real runtime, else null — a simulated
 * runtime is never auto-selected, only kept when explicitly chosen.
 */
export function resolveRuntimeChoice(
  descriptors: RuntimeDescriptor[],
  preferred: string | null,
): string | null {
  const chosen = descriptors.find((descriptor) => descriptor.id === preferred);
  if (chosen && isAvailableRuntime(chosen)) return chosen.id;
  return descriptors.find((d) => isRealRuntime(d) && isAvailableRuntime(d))?.id ?? null;
}

export function hasLaunchableRuntime(descriptors: RuntimeDescriptor[]): boolean {
  return descriptors.some(isAvailableRuntime);
}
