import type { ResolvedAgentConfig } from "@otomat/domain";
import { expect, it } from "vitest";

import { composeTurnPrompt } from "#agents";

const base: ResolvedAgentConfig = {
  runtime: "fake",
  profile_id: null,
  profile_name: null,
  options: {},
  guidance: null,
  skills: [],
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
        canonical_path: "/a",
        content_hash: "h",
        instructions: "step one",
      },
    ],
  };
  const out = composeTurnPrompt("do it", config);
  expect(out).toContain("Be terse");
  expect(out).toContain("Skill A");
  expect(out).toContain("step one");
  expect(out.endsWith("do it")).toBe(true);
});
