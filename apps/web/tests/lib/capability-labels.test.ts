import type { RuntimeCapabilities } from "@otomat/domain";
import { capabilityEntries } from "@web/lib/capability-labels";
import { expect, it } from "vitest";

const CLAUDE: RuntimeCapabilities = {
  stream: true,
  steering: "turn_boundary",
  abort: true,
  resume: true,
  permissions: false,
  diff_hints: false,
};

function entry(capabilities: RuntimeCapabilities, key: keyof RuntimeCapabilities) {
  return capabilityEntries(capabilities).find((candidate) => candidate.key === key);
}

it("names the approval channel for what it is, never as a blanket permission refusal", () => {
  const approvals = entry(CLAUDE, "permissions");
  expect(approvals?.label).toBe("Interactive approvals");
  expect(approvals?.supported).toBe(false);
});

it("explains that an unavailable approval channel leaves the permission mode alone", () => {
  const hint = entry(CLAUDE, "permissions")?.hint ?? "";
  expect(hint).toMatch(/not the run's permission mode/);
  // Every runtime reads this hint, so it names no provider's own mode.
  expect(hint).not.toMatch(/Auto/);
});

it("leaves the self-explanatory capabilities without a hint to read", () => {
  expect(entry(CLAUDE, "stream")?.hint).toBeNull();
  expect(entry(CLAUDE, "resume")?.hint).toBeNull();
});
