import { z } from "zod";

import { commandSucceeded } from "./cli/commands.js";
import { teamHandle } from "./pull-request-facts.js";
import type { CommandRunner } from "./types.js";

const teamSchema = z.object({
  slug: z.string().min(1),
  organization: z.object({ login: z.string().min(1) }),
});

const TEAM_PAGE_SIZE = 100;

/** Null is GitHub declining to answer, typically a token without `read:org`. */
export async function viewerTeams(run: CommandRunner, cwd: string): Promise<string[] | null> {
  const result = await run({
    command: "gh",
    args: ["api", `user/teams?per_page=${TEAM_PAGE_SIZE}`],
    cwd,
  });
  if (!commandSucceeded(result)) return null;
  let payload: unknown;
  try {
    payload = JSON.parse(result.stdout);
  } catch {
    return null;
  }
  const teams = z.array(teamSchema).safeParse(payload);
  if (!teams.success) return null;
  return teams.data.map((team) => teamHandle(team.organization.login, team.slug));
}
