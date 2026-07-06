import type { RuntimeDescriptor } from "@otomat/domain";

type CapabilityKey = keyof RuntimeDescriptor["capabilities"];

const CAPABILITY_LABELS = {
  stream: "Stream",
  send_message: "Send message",
  abort: "Abort",
  resume: "Resume",
  permissions: "Permissions",
  diff_hints: "Diff hints",
} satisfies Record<CapabilityKey, string>;

export const CAPABILITY_ENTRIES: ReadonlyArray<{ key: CapabilityKey; label: string }> =
  Object.entries(CAPABILITY_LABELS).map(([key, label]) => ({ key: key as CapabilityKey, label }));
