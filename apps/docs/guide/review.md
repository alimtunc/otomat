# Review and publish

A run ends on a git diff, not on an agent's summary. The **Diff** tab of the run cockpit is where
you read it; the **PR** tab of the same cockpit is where it becomes a pull request.

## Read the diff

**Diff scope** chooses what is compared:

| Scope            | What you see                                                                                   |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| **Branch**       | The current branch against the base it will land on — the default until a pull request exists. |
| **Step**         | What one step changed, from the tree it started on to the tree it ended on.                    |
| **Commit**       | One commit.                                                                                    |
| **Pull request** | The published head against the branch it targets — the default once one exists.                |

A scope the daemon cannot answer for says so; a diff is never fabricated.

Reading is keyboard-first — the **Keyboard shortcuts** button in the toolbar lists them:

- `j` / `k` move to the next or previous file, `n` / `p` to the next or previous change; `v`
  toggles **Reviewed**, which marks the file, folds it and moves you to the next unread one. A mark is kept as long as the file's patch does not change;
  when a later turn touches the file it comes back unread.
- **Hide reviewed** hides marked files but never one carrying an unresolved comment, and always
  says how many it is holding back.
- **Split** or **Unified** view, **Wrap lines**, sort and **Grouping** by file type (implementation,
  tests, documentation, configuration, assets) — the rail, the keys and the next-unread jump all
  follow the same order.
- **Find in diff** (`⌘F`) searches the patch text; `Enter` and `⇧Enter` step through the matches.
- A file's header action loads the full file around its patch, from the exact blobs the diff was
  taken between.

## Comment

Select a line or a range in the diff — or comment the whole file — and write. Two facts are chosen
per comment, never inferred:

- **Comment destination** — **Agent** stays in Otomat and is what a fix step consumes; **PR
  review** is published to GitHub, and only there. A comment destined to the pull request must
  anchor to lines the pull request's diff shows, inside one hunk, which is GitHub's own rule; a
  range that breaks it is explained, not shortened.
- **Comment kind** — a plain comment, or **Suggest change**, whose replacement applies to the
  head lines it covers.

Comments survive a new head: those the live diff can still place exactly are shown in place, the
others at a named fallback, and the rail says which is which.

## Ask an agent to address comments

**Send N comments**, then **Add fix step**, appends a step to the run with every open
agent-destined comment (at most 50), its anchors and suggestions frozen as its context, plus one
optional note for everything that applies to all of them. The fix step runs in the same worktree once the workspace
is free (it is refused while a turn is live) and, when it finishes, each comment shows the exact
hunk of that step's delta that touched its lines — or states that the file changed but not those
lines. The note is never published to GitHub and never edits a comment.

## Open a pull request

The run's **PR** tab needs an authenticated `gh` and a GitHub remote; it names precisely what is
missing otherwise.

- **Generate PR** asks the configured PR generator agent to write the title and description, then
  commits the workspace, pushes the branch and opens the pull request in one operation. It is
  offered while the form is empty.
- **Customize PR** exposes the form: **Type** and **Scope** of the Conventional Commit subject, the
  **Summary** (with the length budget the type and scope leave), the **Description**, the target
  **Branch** and **Draft** or **Ready for review**. **Generate title & description with AI** fills
  the fields without publishing anything, so you can edit before **Create PR**.

The subject follows Conventional Commits by contract — a free-form title cannot reach git or
GitHub — and the issue identifier is appended by Otomat. Opening the pull request is the one
action that commits the workspace on your behalf.

Publication is a durable operation of the daemon — **writing metadata** when generated, then
**committing → pushing → creating** — followed live, surviving a route change or a closed window. A publication interrupted by a daemon stop is
marked as such and offers **Retry publication**, which is safe to repeat: a clean worktree commits
nothing, an identical push is a no-op, and an existing pull request is reused rather than opened
twice.

## Keep the pull request current

Once a pull request exists, the panel compares the workspace with the published head:

- **Pull request up to date** — the pull request shows exactly the commits the workspace holds.
- **N commits to push** — the workspace is ahead; **Push commits** fast-forwards the head branch.
  Uncommitted changes are listed separately: a push cannot carry them, so they are never counted
  as published.
- **Remote branch diverged** — someone rewrote the remote branch. **Force push with lease** lists
  the commits it would drop and only proceeds if the remote head is still the one you were shown.
  It is refused for a base, default, protected, merged or closed branch.

**Update PR details** edits title, description and draft state on an existing pull request without
touching its commits.

## Review pull requests

The **Reviews** view is a pull-request inbox for the connected GitHub account: what waits on your
review, your own open pull requests, and the ones involving your teams. It reads the daemon's
mirror, so a GitHub outage still shows the last known state. Opening an entry lands on the pull
request reviewer:

- **Overview** — description, commits, changed files, checks, the latest review per reviewer and
  the merge state, read live from GitHub and cached.
- **Diff** — the same reviewer as a run's, over the pull request's pinned head and base.
- **Submit review** — a verdict (**Approve**, **Request changes**, **Comment**), a summary and every
  pending comment go to GitHub in one review, accepted or refused as a whole. Approving your own
  pull request is withheld, as GitHub would.
- **Merge** — offered only when GitHub grants push, the repository allows the chosen method and the
  pull request is open, conflict-free, up to date with its base and not waiting on checks;
  otherwise the reason is written next to the absent button. Otomat never merges locally and never
  enables auto-merge.

A pull request Otomat did not open can be attached to an issue from the issue page: paste its
**PR number or URL**, or pick one of the detected candidates. It is reviewable, not writable — an
agent is only ever pointed at a branch this issue's own workspace holds.

## Links to GitHub

Every pull request card, the run cockpit and the reviewer carry **Open this pull request on
GitHub** and **Copy pull request URL**. Linear issues link back to Linear, and a merge is
[written back](./projects.md#connect-linear) to the mapped state.
