import type { AgentProfileReplicaEntry } from "@otomat/domain";
import { expect, it } from "vitest";

import { mergeAgentProfileReplicas } from "#agents";

function entry(
  id: string,
  overrides: Partial<AgentProfileReplicaEntry> = {},
): AgentProfileReplicaEntry {
  return {
    id,
    name: "Implementer",
    runtime: "fake",
    options: {},
    model: null,
    guidance: null,
    skill_ids: [],
    created_at: "2026-01-01 10:00:00",
    updated_at: "2026-01-01 10:00:00",
    deleted_at: null,
    ...overrides,
  };
}

const ids = (entries: AgentProfileReplicaEntry[]): string[] =>
  entries.filter((candidate) => candidate.deleted_at === null).map((candidate) => candidate.id);

it("keeps the newer edit of one profile and adds what the other host alone holds", () => {
  const mine = [
    entry("a", { name: "Old", updated_at: "2026-01-01 10:00:00" }),
    entry("b", { name: "Mine" }),
  ];
  const theirs = [
    entry("a", { name: "New", updated_at: "2026-01-01 11:00:00" }),
    entry("c", { name: "Theirs" }),
  ];

  const merged = mergeAgentProfileReplicas(mine, theirs);

  expect(merged.find((candidate) => candidate.id === "a")?.name).toBe("New");
  expect(ids(merged).toSorted()).toEqual(["a", "b", "c"]);
});

it("keeps a delete that lands in the same second as an edit on the other host", () => {
  const mine = [entry("a", { name: "Edited" })];
  const theirs = [entry("a", { deleted_at: "2026-01-01 10:00:00" })];

  expect(ids(mergeAgentProfileReplicas(mine, theirs))).toEqual([]);
  expect(ids(mergeAgentProfileReplicas(theirs, mine))).toEqual([]);
});

it("answers the same catalog whichever host merges", () => {
  const mine = [entry("a", { name: "Left" }), entry("b", { guidance: "b" })];
  const theirs = [entry("a", { name: "Right" }), entry("c", { guidance: "c" })];

  expect(mergeAgentProfileReplicas(mine, theirs)).toEqual(mergeAgentProfileReplicas(theirs, mine));
});

it("collapses one definition two hosts grew separately onto the earliest", () => {
  const mine = [entry("a", { created_at: "2026-01-01 09:00:00" })];
  const theirs = [entry("b", { created_at: "2026-01-02 09:00:00" })];

  const merged = mergeAgentProfileReplicas(mine, theirs);

  expect(ids(merged)).toEqual(["a"]);
  expect(merged.find((candidate) => candidate.id === "b")?.deleted_at).not.toBeNull();
});

it("keeps two profiles that share a name but not a definition", () => {
  const mine = [entry("a", { guidance: "review the diff" })];
  const theirs = [entry("b", { guidance: "write the code" })];

  expect(ids(mergeAgentProfileReplicas(mine, theirs)).toSorted()).toEqual(["a", "b"]);
});

it("changes nothing when its own answer is merged back", () => {
  const mine = [entry("a", { created_at: "2026-01-01 09:00:00" }), entry("c", { name: "Other" })];
  const theirs = [entry("b", { created_at: "2026-01-02 09:00:00" })];

  const merged = mergeAgentProfileReplicas(mine, theirs);

  expect(mergeAgentProfileReplicas(mine, merged)).toEqual(merged);
  expect(mergeAgentProfileReplicas(theirs, merged)).toEqual(merged);
});
