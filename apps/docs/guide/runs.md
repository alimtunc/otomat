# Launch a run

A run starts from an issue. Open one from the **Issues** view — a mirrored Linear issue or one you
created with **New issue** — and click **Launch run**. The dialog offers two modes: **Single run** and
**Workflow**.

## Before the first launch

Otomat ships no [agent](./introduction.md#concepts), so create at least one under
_Settings → Global · Local → Agents_ (or under _Settings → Project → Agents_ for one project only).
_Settings → Global · Local → Execution defaults_ sets the runtime, model and options a launch starts
from when nothing more specific says otherwise; the hierarchy is **step → launch → profile → host
default**, and the launcher shows which level answered for each value.

Every choice lists only what the installed CLI announced. A model or option the binary on the
host does not support is refused before anything runs; nothing is silently substituted.

## A single run

1. **Agent** — pick a profile, then adjust the model, permission mode or reasoning level for this
   launch if you want.
2. **Base branch** — the branch the work forks from. Otomat fetches it from its remote and forks
   from what the remote holds, not from your local checkout. Search the list with **Find branch…**.
3. **Add context** — attach further issues or repository files by reference. The issue itself is
   always attached. Attached files are read from the same snapshot of the repository the worktree
   is created from.
4. The note — the text area of the composer — is one optional instruction for what the attached
   context and the agent's own guidance do not already say. It is the only free text a launch
   carries: the issue body is never copied into an editable field.
5. **Launch run**.

Otomat then creates the issue's [workspace](./workspaces.md) — a branch named after the issue
(`feat/<slug>`, or the type a title prefix or tracker label implies) and a worktree — runs the
project's worktree init commands and starts the provider. Everything it froze — agent, model, options, context — is
recorded on the run and replayed verbatim on every resume.

## A workflow

A workflow is several steps in one run, each with its own agent and conversation:

- **Add step** — name it, choose its agent (or **Same as the run** to inherit the launch's) and its
  note. Toggle **After:** to make it wait on other steps; a step with no dependency **Runs first**.
- **Add compete group** — several candidates on a shared objective, each in a worktree forked from
  the run branch. When they finish, you compare their diffs and evidence and **Mark as winner** the
  one to keep; the plan continues from it.
- **Save this workflow as a preset…** keeps the structure — steps, dependencies, agents, notes —
  without any issue, file or run data, as a global preset or one scoped to this project.
  _Settings → Global · Local → Workflow presets_ manages them; a preset whose agent, skill or
  runtime is gone says so before you launch it.

A step's name is a label, never an instruction, and Otomat adds no prompt, role or template of its
own around the agent's guidance.

## What happens next

The run opens in its cockpit: **Conversation**, **Report**, **Logs**, **Diff**, **Files** and **PR** tabs
above the step list. The header strip names the one action the run waits on — _the agent is
working_, _answer the request_, _review the diff_, _publish the pull request_.

- A run that finds every session slot taken is **queued** and says where it stands; the limit is
  per host (_Settings → All hosts → Execution hosts_, four by default).
- A run whose provider refused the work because its quota is exhausted rests on **Waiting on
  provider** with the reset time it proved, and resumes by itself when the window reopens — or
  earlier with **Resume now**.
- A finished run lands on **review ready**: the diff is there to read, nothing is pushed anywhere.

## One issue, one workspace

While an issue's work is unmerged, it owns one run, one branch and one worktree. **Launch run** on such
an issue becomes **Add follow-up step**: the new step joins the same run and works in the same
worktree, with the run's history as context. A second worktree is never forked for the same issue.
The cycle closes when its pull request is merged, when you **Abandon workspace…**, or when the issue
is closed at the tracker; the next launch then starts fresh.
