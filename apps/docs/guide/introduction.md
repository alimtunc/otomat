# Introduction

Otomat is a desktop app for running coding agents against real issues and reviewing what they
produce. You pick an issue, choose an agent, and Otomat launches Claude Code or Codex in a
dedicated git worktree. You follow the conversation live, answer its questions, review the git
diff it wrote, ask for changes, and open a pull request — from one window, without stitching
terminals and browser tabs together.

## Status

Otomat is an **alpha**, distributed for **macOS on Apple Silicon**. Expect rough edges, and read
the [data and security](./data-and-security.md) page before pointing it at a repository you care
about. Windows and Linux desktop builds are not available; a Linux server can host the daemon as a
[remote execution host](./projects.md#add-a-vps-as-an-execution-host).

## How it fits together

Otomat is two processes on your machine:

- the **desktop app**, the window you work in;
- the **daemon**, a local Node process the app starts and stops. It owns the SQLite database, the
  git worktrees, the agent processes and the GitHub and Linear integrations.

The daemon can also run on a server you own. The desktop app then reaches it through an SSH tunnel
and becomes a remote control for the work happening there. What the daemon stores and how it is
reached is described in [Data, privacy and security](./data-and-security.md).

## Concepts

| Term               | Meaning                                                                                                                                |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Project**        | A git repository registered on one execution host, with its own agents, presets and Linear mapping.                                    |
| **Issue**          | The unit of work: an issue mirrored from Linear or one you create in Otomat. It is the durable context of everything launched from it. |
| **Run**            | One launch on an issue: a single step or a workflow of several steps. Its plan is frozen at launch and can only be extended.           |
| **Step**           | One agent working on one task inside a run, in its own conversation. A workflow orders steps by their dependencies.                    |
| **Turn**           | One provider session on a step: the initial launch, a resume, or a follow-up carrying your message.                                    |
| **Workspace**      | The branch and git worktree an issue works in — one per issue while its work is unmerged.                                              |
| **Agent**          | A profile you define: a runtime (Claude Code or Codex), a model, permission settings, instructions and the skills it may activate.     |
| **Execution host** | The machine whose daemon runs the agents: your Mac, or a VPS reached over SSH.                                                         |

## Where to go next

1. [Install Otomat](./install.md) and check the [prerequisites](./prerequisites.md).
2. [Add a project](./projects.md).
3. [Launch a run](./runs.md), then [review and publish](./review.md) the result.
