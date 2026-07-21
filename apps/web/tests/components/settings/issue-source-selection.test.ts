import {
  buildIssueSourceRequest,
  WHOLE_TEAM,
} from "@web/components/settings/integrations/issue-source-selection";
import { expect, it } from "vitest";

const WORKSPACE = {
  teams: [
    { id: "team-1", key: "OTO", name: "Otomat" },
    { id: "team-2", key: "ENG", name: "Engineering" },
  ],
  projects: [
    { id: "project-1", name: "Cockpit", team_ids: ["team-1"] },
    { id: "project-2", name: "Platform", team_ids: ["team-2"] },
  ],
};

it("builds a whole-team mapping without empty project fields", () => {
  expect(
    buildIssueSourceRequest(WORKSPACE, {
      projectId: "local-1",
      teamId: "team-1",
      linearProjectId: WHOLE_TEAM,
    }),
  ).toEqual({
    ok: true,
    request: {
      project_id: "local-1",
      external_team_id: "team-1",
    },
  });
});

it("rejects a stale project selected for another team", () => {
  expect(
    buildIssueSourceRequest(WORKSPACE, {
      projectId: "local-1",
      teamId: "team-2",
      linearProjectId: "project-1",
    }),
  ).toEqual({ ok: false, message: "Pick a Linear project from the selected team." });
});

it("builds a project-scoped mapping only for the owning team", () => {
  expect(
    buildIssueSourceRequest(WORKSPACE, {
      projectId: "local-1",
      teamId: "team-1",
      linearProjectId: "project-1",
    }),
  ).toMatchObject({
    ok: true,
    request: { external_project_id: "project-1" },
  });
});
