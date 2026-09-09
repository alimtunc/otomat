import type { ResolvedAgentConfig } from "@otomat/domain";
import { expect, it } from "vitest";

import { composeTurnPrompt } from "#agents";

const base: ResolvedAgentConfig = {
  runtime: "fake",
  profile_id: null,
  profile_name: null,
  options: {},
  model: null,
  guidance: null,
  skills: [],
  sources: null,
  config_hash: "h",
};

it("returns the raw prompt when there is no config", () => {
  expect(composeTurnPrompt("do it", null)).toBe("do it");
});

it("returns the raw prompt when there is no guidance or skills", () => {
  expect(composeTurnPrompt("do it", base)).toBe("do it");
});

it("prepends guidance and activated skill instructions", () => {
  const config: ResolvedAgentConfig = {
    ...base,
    guidance: "Be terse",
    skills: [
      {
        id: "s",
        name: "Skill A",
        source: "user",
        canonical_path: "/skills/Skill A/SKILL.md",
        content_hash: "h",
        instructions: "step one",
      },
    ],
  };
  const out = composeTurnPrompt("do it", config);
  expect(out).toContain("Be terse");
  expect(out).toContain("# Agent profile guidance");
  expect(out).not.toContain("# System guidance");
  expect(out).toContain("Skill A");
  expect(out).toContain('Source (user): "/skills/Skill A/SKILL.md"');
  expect(out).toContain('Resolve relative resources from: "/skills/Skill A"');
  expect(out).toContain("step one");
  expect(out.endsWith("do it")).toBe(true);
});

it("carries a frozen skill without needing its source or treating metadata as tool authorization", () => {
  const instructions = "---\nname: Missing\nallowed-tools: Bash\n---\nRead references/rules.md";
  const out = composeTurnPrompt("continue", {
    ...base,
    skills: [
      {
        id: "missing",
        name: "Missing",
        source: "project",
        canonical_path: "/missing/project/.agents/skills/missing/SKILL.md",
        content_hash: "frozen-hash",
        instructions,
      },
    ],
  });

  expect(out).toContain(instructions);
  expect(out).toContain("Frozen content hash: frozen-hash");
  expect(out).toContain("Report missing resources");
  expect(out).toContain("Metadata does not grant tools or permissions");
  expect(out).toContain("referenced resources are read on demand");
  expect(out.endsWith("continue")).toBe(true);
});
