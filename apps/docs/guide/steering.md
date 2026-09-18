# Steer a run

Everything below happens in the run's **Conversation** tab, on the step selected in the step list.

## Messages

Type in the composer and press **Send message** (⌘↵). The message is attached to the selected
step and its current session, never to the run at large. Its delivery depends on what the runtime
can do:

- Claude Code accepts a message into its **live session** without waiting for the turn to end;
- Codex delivers it at the **next safe turn boundary**;
- a step that has not started receives it in its first turn, and a run waiting for capacity or on
  a quota carries it in the turn that resumes it. The composer says which of these applies before
  you send, and shows **Queue message** when it will wait.

A message is never lost or delivered twice: it stays visible with its state — queued, delivered,
acknowledged, or failed with the reason — and a failed one can be retried.

### Images

A message can carry up to four PNG, JPEG, GIF or WebP images of at most 5 MB each: pick them with
the image button, drop them on the composer, or paste them from the clipboard. Each one shows as a
thumbnail you can remove before sending, and stays visible in the conversation afterwards, on
this machine or on a remote host — the file travels with the message to the daemon that runs the
session, which stores it under the run and never learns its original path or name.

An image reaches the agent only through a channel its runtime announces: Claude Code takes it in
the same streaming message as the text, alone or with text; Codex takes it with `--image` on the
turn that carries the message, and needs a text message next to it. The composer refuses an
attachment before sending when the selected runtime cannot take images, when a file is not really
an image, or when it exceeds the limits, and says why. No OCR runs and nothing is sent to a third
party.

## Questions and permissions

An agent that stops on a permission it cannot settle itself, a choice, or a written question
raises **Agent is asking** in the conversation, an entry in the Activity Center and the Inbox, and
a desktop notification. Answer it there: pick the options the runtime offered, or write a free
answer when it allowed one. **Approve** or **Refuse** a permission, **Send answer** for a question
or choice; the request is settled once and a duplicate click cannot reach the provider twice.

What an agent may do without asking is the **permission mode** frozen at launch: Claude Code's own
modes (`auto` by default, where the provider's classifier decides each call) and Codex's sandbox
(`workspace-write` by default). Codex's `exec` transport has no approval channel, so a Codex run
cannot relay a permission request; choose a sandbox and approval policy that does not need one, or
**Approve for me**, which lets Codex's automatic reviewer decide inside the chosen sandbox. The
dangerous modes — `bypassPermissions`, `danger-full-access` — are never reached by default and each
asks for an explicit confirmation.

An approval you give never widens the mode the run was launched under. A turn that ends with a
question still unanswered does not release the steps that depend on it: the run rests on
**awaiting human** until you answer, or accept it anyway from the step's guard notice with a
written reason — the run's history then records that a human accepted it.

## Change the model or mode for the next turn

**Settings for next turn**, next to the composer, changes the model or approval mode of the
_next_ turn on that step. The active turn continues unchanged; the first message you send after
that carries the new configuration, and the session records what it was asked for and what the
provider reported. A runtime that cannot resume with another model says so and offers an appended
step instead.

## Stop, cancel, resume

- **Stop step** (conversation header) interrupts the live turn. Nothing is closed: the step lands
  _interrupted_ and its queued messages are held until you send a message or resume.
- **Cancel run** (run actions menu, `⋯`) stops every unfinished step. The branch, the worktree and
  the diff stay exactly as they are.
- A stopped run is **resumed** by sending a message: Otomat reattaches the provider's own session
  when it still exists, and otherwise opens a recovery session on the same step and worktree, with
  the run's goal, plan, diff and failure as context. The composer states which of the two will
  happen. A run that finished normally takes new work as a
  [follow-up step](./runs.md#one-issue-one-workspace) instead.
- **Abandon workspace…** stamps the run as abandoned and stops the plan. It deletes no branch,
  worktree or commit, and shows what stays reachable before asking; it is refused while a turn is
  live.

## Background execution

Closing the window does not stop anything. With local work in flight, Otomat asks whether to
**Keep Running in Background** (the window hides, the daemon and its runs continue), **Stop Runs
and Quit**, or cancel. Reopening the app shows the same run where you left it. The menu-bar item
lists what is running and what waits on you.

Runs on a [remote host](./projects.md#add-a-vps-as-an-execution-host) never depend on the app at
all.

An update of the app itself is refused while any host has a run in flight (see
[Update](./install.md#update)).
