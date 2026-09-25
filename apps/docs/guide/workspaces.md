# Workspaces and files

A workspace is the branch and git worktree an issue works in. Worktrees live under Otomat's own
data directory, registered with your repository through `git worktree`, so your checkout stays on
the branch you left it on.

## Where a workspace lives

- _Settings → Project → Workspaces_ lists every worktree of the project on each host with its
  state: **active** while the issue's cycle holds it, **cleanup required** once the cycle closed
  with the directory still on disk, **stale** or **missing** when git and Otomat disagree, and
  **unmanaged** for a worktree Otomat did not create — it never deletes those on its own.
- **Refresh worktrees** rescans `git worktree list` and the host's pull requests, then updates the
  states shown. It deletes or changes no worktree, whatever the auto-delete setting says.
- The run actions menu (`⋯`) and the issue header carry **Open in VS Code** and **Open in
  terminal** for the run's worktree. A remote worktree opens through VS Code's SSH remote; a
  remote terminal is a copyable `ssh` command Otomat never runs itself.
- Otomat reads the real git state on every read; nothing about a workspace is cached in a way a
  restart could make stale.

## Use a terminal

The sidebar’s **Terminal** opens a session in the selected project’s registered
checkout, without creating an issue or run. Changes happen directly in that
folder. Choose **Open shell**, **Claude** or **Codex**; CLI launches show their
invocation before confirmation and send no issue context. Each project keeps its
own session when you navigate away or switch projects. **Copy terminal command**
provides the external fallback; on a remote host the button is **Copy SSH command**.

Find current and ended terminal sessions in [Conversations](./conversations.md).
Their recent output is saved locally, including after a restart; an ended session
opens read-only. Claude/Codex terminal output keeps its terminal format.

In the desktop app, open **Terminal** on an issue or in its run cockpit, then choose
**Open shell**. The shell starts in that issue's worktree. If no workflow has
started yet, Otomat prepares the worktree; the first workflow will reuse it and
keep your changes. Opening the tab alone starts nothing. The Terminal tab uses
the full content area; switch back to **Activity** for the issue details. The branch
stays visible above the terminal, with a button to copy the worktree path.

**Claude** and **Codex** open a confirmation with the issue context. Expand
**Executable & arguments** to inspect the exact invocation before starting. Turn
off **Include issue context** to open the CLI without sending the issue title or
description. It still starts in the same worktree and can read its files and local
CLI instructions. They require the CLI to be
installed on the local host. End an existing shell before starting a CLI this way.
These are your sessions: they neither advance a workflow nor contribute to its
recorded cost. Provider charges still apply to CLI usage.

Switching tabs keeps the process alive. After a connection interruption, the tab
reattaches to the same session and shows recent output; input is never retried
silently. If older output was discarded, the terminal says so. **End session** asks
for confirmation before stopping the shell and its active command. Closing the window offers to keep active work in the background or stop it and
quit. A daemon restart ends the session; starting another is an explicit action.
Worktree cleanup is blocked while its terminal is active.

**Open in external terminal** opens macOS Terminal. On a VPS, use **Copy SSH command**
and paste the inspected command into your own terminal; the integrated terminal is
local only. External terminals have their own lifecycle.

## Edit files

The run cockpit's **Files** tab lists the whole worktree — uncommitted and untracked work included,
ignored files excluded — and opens any text file in an editor with find, folding, multiple
cursors and the command palette (`F1`). `⌘P` jumps to a file by name. Git status decorates names
and folders; a deleted path stays listed and opens its diff.

A path `.gitignore` covers, such as `.env`, can still be created and edited: it opens with an
**Ignored by Git** notice, stays listed in the explorer while the Files tab is open, and never
reaches the diff or a pull request. Naming an existing ignored file in **New file** opens it.

Saving checks that the file on disk is still the one you opened: a save over a file an agent
changed meanwhile is refused with a **Reload** that discards your edit, never a silent overwrite.
An archived worktree opens read-only. Saving writes the file and refreshes the diff; it starts no
agent turn and is not part of the run's history.

**Changes**, beside Files, is a staging area: **Staged Changes** and **Changes** diffs, **Stage**,
**Unstage** or **Discard changes** for a file, a block or a line selection, and a commit form that
commits the index with your configured git identity — hooks and signing apply. Discarding asks
first and is irreversible.

The **Files** view in the sidebar does the same on the project's real checkout: browse, edit,
stage, commit, and publish a pull request from your own branch without any run involved.

## Clean up

Otomat deletes a worktree only when the issue's cycle is closed, nothing is writing to it and the
tree is clean; otherwise it names the blocker. Only a blocker about the work left on disk —
uncommitted changes, or a worktree git could not read — can be overridden: the dialog shows the
branch, the path and what it discards, and waits for you to confirm that loss. Every surface goes
through the same confirmation, and a git refusal is reported as such rather than as a deletion.

- **Clean workspace…** in the run actions menu, or the row action in _Settings → Project →
  Workspaces_, removes one worktree.
- **Clean up merged worktrees**, above the table, lists the clean worktrees whose pull request is
  merged and deletes them once you confirm.
- **Remove worktree** on an **unmanaged** row asks git to remove that worktree from the repository;
  a clean one goes after a short confirmation, a dirty one after the loss confirmation above. No
  branch, pull request or run is touched.
- **Automatically delete this project's workspaces after merge**, in _Settings → Project →
  Workspaces_, lets Otomat remove the worktree of a merged pull request by itself when the merge
  closes the cycle. A merge made outside Otomat is noticed on the next refresh; unmerged cycles
  always wait for you.
- Deleting a worktree never deletes a commit. The branch an Otomat cycle still owns goes with its
  worktree; any other branch stays in the repository until you remove it yourself.
