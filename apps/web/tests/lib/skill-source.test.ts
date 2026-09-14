import { skillSourceRoot } from "@web/lib/skill-source";
import { expect, it } from "vitest";

it("identifies repository and user skill roots without conflating names", () => {
  expect(
    skillSourceRoot({
      canonical_path: "/repo/.agents/skills/agents-sdk/SKILL.md",
      source: "project",
    }),
  ).toBe(".agents/skills");
  expect(
    skillSourceRoot({
      canonical_path: "/home/alice/.claude/skills/agents-sdk/SKILL.md",
      source: "user",
    }),
  ).toBe("~/.claude/skills");
  expect(
    skillSourceRoot({ canonical_path: "/opt/bundle/agents-sdk/SKILL.md", source: "project" }),
  ).toBe("/opt/bundle");
});

it("keeps a user skill's resolved source when it lives outside the home skill root", () => {
  expect(
    skillSourceRoot({ canonical_path: "/repo/.agents/skills/review/SKILL.md", source: "user" }),
  ).toBe("/repo/.agents/skills");
});
