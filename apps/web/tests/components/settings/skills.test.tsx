// @vitest-environment happy-dom
import { SkillMultiSelect } from "@web/components/agents/agent-profile/shared/skill-multi-select";
import { SkillCatalogPanel } from "@web/components/settings/skills/catalog-panel";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { skillContract } from "#support/agent";
import { setInputValue } from "#support/dom-events";
import { findLabelled } from "#support/dom-queries";
import { mountWithQuery, type Mounted } from "#support/mount";

const skills = [
  skillContract({
    id: "project",
    project_id: "project",
    canonical_path: "/repo/.agents/skills/review/SKILL.md",
    description: "Review source code",
  }),
  skillContract({ id: "user", description: "Review architecture" }),
  skillContract({
    id: "invalid",
    name: "Broken",
    status: "invalid",
    invalid_reason: "missing_frontmatter",
  }),
];
let mounted: Mounted | null = null;
vi.mock("@web/api/skills/queries", () => ({
  useSkills: () => ({ data: skills, isPending: false, isError: false }),
}));
vi.mock("@web/api/skills/mutations", () => ({
  useScanSkills: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
  useSetSkillEnabled: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
}));
afterEach(async () => {
  await mounted?.cleanup();
  mounted = null;
  document.body.replaceChildren();
});

it("keeps homonymous skills selectable by their own identity and exposes canonical provenance", async () => {
  const toggle = vi.fn();
  mounted = await mountWithQuery(
    <SkillMultiSelect skills={skills} selectedIds={[]} onToggle={toggle} />,
  );
  expect(document.querySelectorAll("[role=checkbox]")).toHaveLength(3);
  await act(async () => {
    findLabelled("Review · .agents/skills")?.click();
  });
  expect(toggle).toHaveBeenCalledWith("project");
  await act(async () => {
    findLabelled("Details for Review · ~/.claude/skills")?.click();
  });
  expect(document.body.textContent).toContain("/home/u/.claude/skills/review/SKILL.md");
  expect(document.body.textContent).toContain("Review architecture");
});

it("filters the picker by description or canonical path without discarding a hidden selection", async () => {
  const toggle = vi.fn();
  mounted = await mountWithQuery(
    <SkillMultiSelect skills={skills} selectedIds={["project"]} onToggle={toggle} />,
  );
  const input = document.querySelector<HTMLInputElement>("input[aria-label='Search skills']");
  if (input === null) throw new Error("Search missing");
  await act(async () => {
    setInputValue(input, "architecture");
  });
  expect(document.querySelectorAll("[role=checkbox]")).toHaveLength(1);
  expect(findLabelled("Review · ~/.claude/skills")).toBeDefined();
  await act(async () => {
    setInputValue(input, "/repo/");
  });
  expect(findLabelled("Review · .agents/skills")?.getAttribute("aria-checked")).toBe("true");
  expect(toggle).not.toHaveBeenCalled();
});

it("limits a catalog search to the current owner while keeping invalid state visible", async () => {
  mounted = await mountWithQuery(
    <SkillCatalogPanel owner={null} emptyTitle="Empty" emptyDescription="No skills" />,
  );
  expect(findLabelled("Review · .agents/skills")).toBeUndefined();
  expect(document.body.textContent).toContain("Broken");
  const input = document.querySelector<HTMLInputElement>("input[aria-label='Search skills']");
  if (input === null) throw new Error("Search missing");
  await act(async () => {
    setInputValue(input, "architecture");
  });
  expect(document.querySelectorAll("[role=switch]")).toHaveLength(1);
  expect(findLabelled("Review · ~/.claude/skills")).toBeDefined();
});
