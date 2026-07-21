import type { CreateIssueSourceRequest, LinearWorkspaceContract } from "@otomat/domain";

export const WHOLE_TEAM = "";

interface IssueSourceSelection {
  projectId: string;
  teamId: string;
  linearProjectId: string;
}

type IssueSourceRequestResolution =
  | { ok: true; request: CreateIssueSourceRequest }
  | { ok: false; message: string };

export function buildIssueSourceRequest(
  workspace: LinearWorkspaceContract,
  selection: IssueSourceSelection,
): IssueSourceRequestResolution {
  if (selection.projectId === "") return { ok: false, message: "Pick a local project." };

  const team = workspace.teams.find((candidate) => candidate.id === selection.teamId);
  if (team === undefined) return { ok: false, message: "Pick a Linear team." };

  const linearProject = workspace.projects.find(
    (candidate) =>
      candidate.id === selection.linearProjectId && candidate.team_ids.includes(team.id),
  );
  if (selection.linearProjectId !== WHOLE_TEAM && linearProject === undefined) {
    return { ok: false, message: "Pick a Linear project from the selected team." };
  }

  const teamScope: CreateIssueSourceRequest = {
    project_id: selection.projectId,
    external_team_id: team.id,
  };
  return linearProject === undefined
    ? { ok: true, request: teamScope }
    : {
        ok: true,
        request: {
          ...teamScope,
          external_project_id: linearProject.id,
        },
      };
}
