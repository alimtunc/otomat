import { getProject, type Db } from "@otomat/db";
import {
  summarizeProjectHealth,
  type ProjectHealthCheck,
  type ProjectHealthCheckId,
  type ProjectHealthOutcome,
  type ProjectHealthReport,
} from "@otomat/domain";

import type { RepositoryResolver } from "#git";
import type { GitHubService } from "#github";
import type { LinearService } from "#linear";

import { agentsCheck } from "./checks/agents.js";
import { daemonCheck, type DaemonIdentity } from "./checks/daemon.js";
import { gitRemoteCheck } from "./checks/git-remote.js";
import { githubCheck } from "./checks/github.js";
import { linearCheck } from "./checks/linear.js";
import { repositoryCheck } from "./checks/repository.js";
import { runtimesCheck } from "./checks/runtimes.js";
import { worktreesRootCheck } from "./checks/worktrees-root.js";

export interface ProjectHealthContext {
  db: Db;
  repositories: RepositoryResolver;
  github: GitHubService;
  linear: LinearService;
  daemon: DaemonIdentity;
}

interface Probe {
  id: ProjectHealthCheckId;
  label: string;
  run(): ProjectHealthOutcome | Promise<ProjectHealthOutcome>;
}

/** A probe that throws leaves its own check undetermined; the report is worth most when the host is broken. */
async function settle(probe: Probe): Promise<ProjectHealthCheck> {
  try {
    return { id: probe.id, label: probe.label, ...(await probe.run()) };
  } catch (error) {
    console.error(`[otomat] health check ${probe.id} failed`, error);
    return {
      id: probe.id,
      label: probe.label,
      status: "unknown",
      message: "This check could not run on this host.",
      remediation: "Re-run the health check; if it keeps failing, read this host's daemon log.",
    };
  }
}

/** Null for a project this host does not hold; the caller answers 404 rather than inventing a report. */
export async function checkProjectHealth(
  context: ProjectHealthContext,
  projectId: string,
): Promise<ProjectHealthReport | null> {
  const project = getProject(context.db, projectId);
  if (!project) return null;

  const binding = context.repositories.forProject(projectId);
  const probes: Probe[] = [
    { id: "daemon", label: "Daemon and host", run: () => daemonCheck(context.daemon) },
    { id: "repository", label: "Repository", run: () => repositoryCheck(binding) },
    { id: "git_remote", label: "Remote and base branch", run: () => gitRemoteCheck(binding) },
    {
      id: "worktrees_root",
      label: "Worktrees root",
      run: () => worktreesRootCheck(context.repositories.worktreesRoot),
    },
    {
      id: "linear",
      label: "Linear integration",
      run: () => linearCheck(context.linear, projectId),
    },
    { id: "github", label: "GitHub authentication", run: () => githubCheck(context.github) },
    { id: "runtimes", label: "Agent runtimes", run: () => runtimesCheck(context.db) },
    {
      id: "agents",
      label: "Agent profiles and skills",
      run: () => agentsCheck(context.db, projectId),
    },
  ];

  const checks: ProjectHealthCheck[] = [];
  for (const probe of probes) checks.push(await settle(probe));

  return {
    project_id: projectId,
    checked_at: new Date().toISOString(),
    status: summarizeProjectHealth(checks),
    checks,
  };
}
