# Workspaces and files

A workspace is the branch and git worktree an issue works in. Worktrees live under Otomat's own
data directory, registered with your repository through `git worktree`, so your checkout stays on
the branch you left it on.

## Where a workspace lives

- _Settings → Project → Workspaces_ lists every worktree of the project on each host with its
  state: **active** while the issue's cycle holds it, **cleanup required** once the cycle closed
  with the directory still on disk, **stale** or **missing** when git and Otomat disagree, and
  **unmanaged** for a worktree Otomat did not create — it never touches those.
- The run actions menu (`⋯`) and the issue header carry **Open in VS Code** and **Open in
  terminal** for the run's worktree. A remote worktree opens through VS Code's SSH remote; a
  remote terminal is a copyable `ssh` command Otomat never runs itself.
- Otomat reads the real git state on every read; nothing about a workspace is cached in a way a
  restart could make stale.

## Edit files

The run cockpit's **Files** tab lists the whole worktree — uncommitted and untracked work included,
ignored files excluded — and opens any text file in an editor with find, folding, multiple
cursors and the command palette (`F1`). `⌘P` jumps to a file by name. Git status decorates names
and folders; a deleted path stays listed and opens its diff.

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
tree is clean; otherwise it names the blocker. Every surface goes through the same confirmation.

- **Clean workspace…** in the run actions menu, or the row action in _Settings → Project →
  Workspaces_, removes one worktree. Git's own refusal — uncommitted work — is reported and nothing
  is forced.
- **Automatically delete this project's workspaces after merge**, in _Settings → Project →
  Workspaces_, lets Otomat remove the worktree of a merged pull request by itself. A merge made outside Otomat is noticed on the next reconciliation pass; unmerged cycles
  always wait for you.
- Deleting a worktree never deletes a branch or a commit. Branches stay in the repository until you
  remove them yourself.
