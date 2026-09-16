import type { CheckoutTarget, ExecutionHostId } from "@otomat/domain";

/** One remembered selection and fold state per host and checkout; the URL carries it so a picked file survives a reload. */
export function fileScope(host: ExecutionHostId, target: CheckoutTarget): string {
  return `${host}:${target.kind}:${target.id}`;
}
