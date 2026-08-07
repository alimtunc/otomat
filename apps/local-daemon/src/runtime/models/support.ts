import type { BinaryProbe, RuntimeModel } from "@otomat/domain";

export interface ModelDiscoveryResult {
  discovery: BinaryProbe;
  /** Non-empty only when `discovery.status` is `ok`; a failed probe never yields entries. */
  models: RuntimeModel[];
}

/** How an adapter handles model selection. Declared by the provider module, never inferred. */
export interface RuntimeModelSupport {
  /** Whether an identifier outside the catalog may be requested. */
  readonly allowsCustom: boolean;
  /** The documented set Otomat ships for this provider. Not a claim about the user's account. */
  readonly staticModels: readonly RuntimeModel[];
  /** Local, credential-free listing for the installed binary. */
  readonly discover: () => ModelDiscoveryResult;
}

export function unsupportedDiscovery(detail: string): ModelDiscoveryResult {
  return { discovery: { status: "unsupported", detail }, models: [] };
}
