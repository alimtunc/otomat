import { randomUUID } from "node:crypto";

import {
  interruptTerminalRecords,
  readTerminalOutput,
  getIssue,
  getRepository,
  getRun,
  type Db,
} from "@otomat/db";
import type { TerminalOpenRequest, TerminalSession } from "@otomat/domain";

import { inCheckout, WorktreeConflictError, type RepositoryResolver } from "#git";
import { probeLocalRepository } from "#git/probe";
import { validateInteractiveWorktree } from "#git/validate-worktree";
import { findWorktreeById } from "#git/worktrees-store";
import type { Supervisor } from "#supervisor";
import { issueWorkspace } from "#supervisor/workspace";
import { canonicalIssueWorktree } from "#supervisor/workspace-preparation";

import { terminalContext } from "./context.js";
import { launchTerminal, type TerminalLaunchTarget } from "./launch.js";
import type { UserTerminal } from "./session.js";

export class TerminalService {
  readonly instance = randomUUID();
  private readonly sessions = new Map<string, UserTerminal>();
  private stopping = false;

  constructor(
    private readonly db: Db,
    private readonly repositories: RepositoryResolver,
    private readonly supervisor: Supervisor,
  ) {
    interruptTerminalRecords(db);
  }

  list(): TerminalSession[] {
    return [...this.sessions.values()].map((session) => session.info);
  }

  hasRepositorySessions(repositoryId: string): boolean {
    const repository = getRepository(this.db, repositoryId);
    return this.list().some(
      (session) =>
        session.state !== "exited" &&
        ((session.worktree_id !== null &&
          findWorktreeById(this.db, session.worktree_id)?.repository_id === repositoryId) ||
          session.project_id === repository?.project_id),
    );
  }

  requireInstance(instance: string): void {
    if (this.stopping || instance !== this.instance)
      throw new WorktreeConflictError(
        "The host or daemon changed. Reconnect before using the terminal.",
      );
  }

  async open(request: TerminalOpenRequest): Promise<TerminalSession> {
    this.requireInstance(request.instance);
    if ("project_id" in request) return this.openProject(request);
    if (request.run_id !== null) {
      const run = getRun(this.db, request.run_id);
      const canonical = issueWorkspace(this.db, request.issue_id);
      if (
        canonical.state !== "open" ||
        run?.issue_id !== request.issue_id ||
        canonical.run_id !== run.id
      )
        throw new WorktreeConflictError("This run no longer owns the issue workspace.");
    }
    const id = await this.supervisor.prepareIssueWorkspace(request.issue_id);
    const row = findWorktreeById(this.db, id);
    if (!row) throw new WorktreeConflictError("Worktree unavailable.");
    return inCheckout(row.path, async () => {
      this.requireInstance(request.instance);
      const issue = getIssue(this.db, request.issue_id);
      const binding = issue ? this.repositories.forProject(issue.project_id) : null;
      if (
        !issue ||
        issue.status === "done" ||
        issue.status === "canceled" ||
        !binding ||
        binding.repositoryId !== row.repository_id
      )
        throw new WorktreeConflictError("The issue workspace has changed.");
      await validateInteractiveWorktree(
        this.repositories.worktreesRoot,
        binding.rootPath,
        row.path,
        row.branch,
      );
      this.requireInstance(request.instance);
      if (canonicalIssueWorktree(this.db, request.issue_id)?.id !== id)
        throw new WorktreeConflictError(
          "The canonical issue workspace changed. Reopen the terminal.",
        );
      if (request.run_id !== null) {
        const canonical = issueWorkspace(this.db, request.issue_id);
        if (canonical.state !== "open" || canonical.run_id !== request.run_id)
          throw new WorktreeConflictError("This run no longer owns the issue workspace.");
      }
      const existing = [...this.sessions.values()].find(
        (session) => session.info.issue_id === issue.id && session.info.state !== "exited",
      );
      if (existing) {
        if (existing.info.worktree_id !== id)
          throw new WorktreeConflictError(
            "End this issue's previous terminal session before opening its new workspace.",
          );
        if (request.tool !== null)
          throw new WorktreeConflictError(
            "End the existing terminal session before starting a CLI.",
          );
        return existing.info;
      }
      const preview =
        request.tool === null || request.context_hash === null
          ? null
          : terminalContext(this.db, issue.id, request.tool);
      if (preview && preview.context_hash !== request.context_hash)
        throw new WorktreeConflictError(
          "The issue context changed. Inspect it again before starting.",
        );
      const info = {
        project_id: issue.project_id,
        issue_id: issue.id,
        worktree_id: id,
        path: row.path,
        branch: row.branch,
        tool: request.tool,
      };
      return this.start(info, preview?.argv ?? []);
    });
  }

  private async openProject(
    request: Extract<TerminalOpenRequest, { project_id: string }>,
  ): Promise<TerminalSession> {
    const binding = this.repositories.forProject(request.project_id);
    if (!binding) throw new WorktreeConflictError("Connect a repository to this project first.");
    return inCheckout(binding.rootPath, async () => {
      const probe = await probeLocalRepository(binding.rootPath);
      this.requireInstance(request.instance);
      const current = this.repositories.forProject(request.project_id);
      if (
        !probe.ok ||
        probe.rootPath !== binding.rootPath ||
        current?.repositoryId !== binding.repositoryId ||
        current.rootPath !== binding.rootPath
      )
        throw new WorktreeConflictError(
          "The registered project checkout changed or is unavailable.",
        );
      const existing = this.list().find(
        (session) =>
          session.project_id === request.project_id &&
          session.issue_id === null &&
          session.state !== "exited",
      );
      if (existing) {
        if (existing.path !== probe.rootPath || request.tool !== null)
          throw new WorktreeConflictError(
            "End the existing project terminal before starting another.",
          );
        return existing;
      }
      return this.start(
        {
          project_id: request.project_id,
          issue_id: null,
          worktree_id: null,
          path: probe.rootPath,
          branch: probe.defaultBranch,
          tool: request.tool,
        },
        [],
      );
    });
  }

  private start(target: TerminalLaunchTarget, argv: string[]): TerminalSession {
    if (this.list().filter((session) => session.state !== "exited").length >= 8)
      throw new WorktreeConflictError(
        "End a terminal before opening another (8 active sessions maximum).",
      );
    const session = launchTerminal(this.db, target, argv);
    const info = session.info;
    for (const [key, previous] of this.sessions) {
      if (
        previous.info.state === "exited" &&
        (previous.info.path === info.path || this.sessions.size >= 32)
      )
        this.sessions.delete(key);
    }
    this.sessions.set(info.id, session);
    return info;
  }

  output(instance: string, id: string, after: number) {
    this.requireInstance(instance);
    const live = this.sessions.get(id);
    const output = live ? live.output(after) : readTerminalOutput(this.db, id, after);
    if (!output) throw new WorktreeConflictError("This terminal session is not on this host.");
    return output;
  }

  get(instance: string, id: string): UserTerminal {
    this.requireInstance(instance);
    const session = this.sessions.get(id);
    if (!session)
      throw new WorktreeConflictError("Session lost or expired. Open a new terminal explicitly.");
    return session;
  }

  async shutdown(): Promise<void> {
    this.stopping = true;
    const results = await Promise.allSettled(
      [...this.sessions.values()].map((session) => session.close()),
    );
    const failures = results.flatMap((result) =>
      result.status === "rejected" ? [result.reason] : [],
    );
    if (failures.length)
      throw new AggregateError(failures, "Some terminal sessions could not stop.");
  }
}
