import { afterEach, beforeEach, expect, it } from "vitest";

import type { LinearIssueEditor } from "#linear";
import { linearDetail, setupLinearWritebackTest } from "#test-support/linear-writeback";

let test: ReturnType<typeof setupLinearWritebackTest>;

beforeEach(() => {
  test = setupLinearWritebackTest();
});

afterEach(() => test.cleanup());

it("maps the editor state from real remote values and team metadata", async () => {
  test.seedLinearIssue();
  const editor: LinearIssueEditor = {
    issue: linearDetail(),
    team: {
      team_id: "t1",
      states: [{ id: "s-todo", name: "Todo", type: "unstarted", color: "#888" }],
      members: [{ id: "u1", name: "Alim" }],
      labels: [{ id: "lab1", name: "Bug", color: "#f00" }],
    },
  };
  const service = await test.connectedService({ issueEditor: async () => editor });

  const state = await service.writeback.editorState("li");
  expect(state.snapshot.assignee_id).toBe("u1");
  expect(state.snapshot.label_ids).toEqual(["lab1"]);
  expect(state.team_metadata.states[0].name).toBe("Todo");
});
