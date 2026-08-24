import type { RuntimeCapabilities } from "@otomat/domain";
import { capabilityEntries } from "@web/lib/capability-labels";
import { expect, it } from "vitest";

const CLAUDE: RuntimeCapabilities = {
  stream: true,
  steering: "turn_boundary",
  abort: true,
  resume: true,
  resume_model: { status: "supported" },
  interactions: { status: "supported", kinds: ["permission"] },
  diff_hints: false,
  provider_limit: "deadline",
};

const CODEX: RuntimeCapabilities = {
  ...CLAUDE,
  interactions: { status: "unsupported", reason: "`codex exec` has no approval channel." },
};

function entry(capabilities: RuntimeCapabilities, key: keyof RuntimeCapabilities) {
  return capabilityEntries(capabilities).find((candidate) => candidate.key === key);
}

it("names the kinds a runtime can genuinely answer, never a blanket permission flag", () => {
  const interactions = entry(CLAUDE, "interactions");
  expect(interactions?.label).toBe("Interactive approvals");
  expect(interactions?.supported).toBe(true);
});

it("explains that the channel is not the run's permission mode", () => {
  const hint = entry(CLAUDE, "interactions")?.hint ?? "";
  expect(hint).toMatch(/not the run's permission mode/);
  // Every runtime reads this hint, so it names no provider's own mode.
  expect(hint).not.toMatch(/Auto/);
});

it("shows the adapter's own reason when it cannot round-trip a question", () => {
  const interactions = entry(CODEX, "interactions");
  expect(interactions?.supported).toBe(false);
  expect(interactions?.hint).toBe("`codex exec` has no approval channel.");
});

it("leaves the self-explanatory capabilities without a hint to read", () => {
  expect(entry(CLAUDE, "stream")?.hint).toBeNull();
  expect(entry(CLAUDE, "resume")?.hint).toBeNull();
});
