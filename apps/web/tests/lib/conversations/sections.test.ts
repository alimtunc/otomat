import { groupConversations } from "@web/lib/conversations/sections";
import { expect, it } from "vitest";

import {
  conversationEntry,
  crmConversationEntry,
  terminalConversationEntry,
} from "#support/conversations";

const finished = (step: string, issueId: string) =>
  conversationEntry({
    id: `conversation:${step}`,
    step_run_id: step,
    step_status: "succeeded",
    issue: { id: issueId, identifier: null, title: issueId, cycle: null },
  });

it("sections by the issue's cycle, one group per issue, and hides an empty section", () => {
  const sections = groupConversations([
    conversationEntry(),
    conversationEntry({
      id: "conversation:step-2",
      step_run_id: "step-2",
      step_status: "succeeded",
      read: true,
    }),
    finished("step-3", "issue-2"),
    conversationEntry({
      id: "conversation:step-4",
      step_run_id: "step-4",
      issue: { id: "issue-3", identifier: "OTO-3", title: "Review it", cycle: "reviewing" },
    }),
  ]);

  expect(
    sections.map((section) => [
      section.label,
      section.projects
        .flatMap((project) => project.groups)
        .map((group) => [
          group.issue?.id,
          group.entries.filter((entry) => "step_run_id" in entry).map((entry) => entry.step_run_id),
        ]),
    ]),
  ).toEqual([
    [
      "Following",
      [
        ["issue-1", ["step-1", "step-2"]],
        ["issue-3", ["step-4"]],
      ],
    ],
    ["Recently finished", [["issue-2", ["step-3"]]]],
  ]);
  expect(groupConversations([conversationEntry()]).map((section) => section.key)).toEqual([
    "active",
  ]);
});

it("keeps all finished issues reachable", () => {
  const entries = Array.from({ length: 12 }, (_, index) =>
    finished(`step-${index}`, `issue-${index}`),
  );

  const [section] = groupConversations(entries);

  expect(section?.key).toBe("finished");
  expect(section?.projects[0]?.groups).toHaveLength(12);
});

it("groups a project terminal without inventing an issue and keeps active terminals active", () => {
  const ended = terminalConversationEntry();
  const issue = conversationEntry().issue;
  const live = terminalConversationEntry({
    id: "terminal:live",
    issue,
    terminal: { ...ended.terminal, id: "live", issue_id: issue.id, state: "running" },
  });
  const sections = groupConversations([conversationEntry(), live, ended]);
  expect(sections[0]?.projects[0]?.groups[0]?.entries).toHaveLength(2);
  expect(sections[1]?.projects[0]?.groups[0]).toMatchObject({
    id: "project:p1",
    issue: null,
    entries: [ended],
  });
});

it("gives each project its own group, ranked by its newest thread, without mixing their issues", () => {
  const crm = crmConversationEntry().project;
  const otomat = conversationEntry().project;
  const thread = (step: string, project: typeof crm, issue: string) =>
    conversationEntry({
      id: `conversation:${step}`,
      step_run_id: step,
      project,
      issue: { id: issue, identifier: issue, title: issue, cycle: "running" },
    });

  const [following] = groupConversations([
    thread("b", otomat, "OTO-9"),
    thread("a", crm, "CRM-2"),
    thread("c", crm, "CRM-1"),
    thread("d", otomat, "OTO-9"),
    thread("e", crm, "CRM-2"),
  ]);

  expect(
    following?.projects.map(({ project, groups }) => [
      project.name,
      groups.map((group) => [
        group.issue?.id,
        group.entries.map((entry) => ("step_run_id" in entry ? entry.step_run_id : null)),
      ]),
    ]),
  ).toEqual([
    ["Otomat", [["OTO-9", ["b", "d"]]]],
    [
      "CRM",
      [
        ["CRM-2", ["a", "e"]],
        ["CRM-1", ["c"]],
      ],
    ],
  ]);
});
