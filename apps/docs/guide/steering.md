# Steer a run

Everything below happens in the run's **Conversation** tab, on the step selected in the step list.

## Messages

Type in the composer at the bottom of the conversation and press **Send message** (⌘↵). The
message is attached to the selected step and its current session, never to the run at large. Its
delivery depends on what the runtime can do:

- Claude Code accepts a message into its **live session** without waiting for the turn to end,
  unless the next turn's model or effort was changed: the message then waits for the turn to end;
- Codex delivers it at the **next safe turn boundary**;
- a step that has not started receives it in its first turn, and a run waiting for capacity or on
  a quota carries it in the turn that resumes it. The composer says which of these applies before
  you send, and shows **Queue message** when it will wait.

While the agent is waiting on a question or a permission request, answer it in its card: a message
sent from the composer does not answer it.

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

## QR codes

A QR code an agent prints in the conversation as block characters (`█ ▀ ▄`, as `qrencode` or
`qrcode-terminal` emit it) renders as a scannable black-on-white grid with its quiet zone, in either
theme, and scales down with the pane instead of scrolling. **Copy code** still copies the text the
agent sent. A block that does not carry a complete QR symbol stays an ordinary code block.

## Questions and permissions

An agent that stops on a permission it cannot settle itself, a choice, or a written question
raises **Agent is asking** in the conversation, an entry in the Activity Center and the Inbox, and
a desktop notification. Answer it there: pick the options the runtime offered, or write a free
answer when it allowed one. **Approve** or **Refuse** a permission, **Send answer** for a question
or choice; the request is settled once and a duplicate click cannot reach the provider twice.

While it waits, its issue reads **Waiting on you** instead of **Running** on the board, in the
issue list and on the issue page, and its [sidebar group](./conversations.md#reading-and-answering)
stays open. Opening the card or the row lands on the request itself. Once you answer and the agent resumes, every view returns to
**Running** together. The issue's own status — Linear's **In Progress**, for instance — is left
as it is.

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

The **Next turn** control in the composer shows the model and effort the _next_ turn on that step
will use. Pick another model or effort from its menu and it applies at once — only the models and
efforts the step's own runtime announces on this host are offered, and the runtime itself never
changes. Codex also shows its next-turn approval mode beside it. The active turn and the turns
already launched keep their configuration; the next message you send, or **Resume run**, starts
the turn with the new one — at the bottom of a stopped run, the control appears only on the step
**Resume run** reopens — and the session records what it was asked for and what the provider
reported. A model that does not offer the current effort is not applied with another one in its
place: the menu asks you to choose an effort it offers, or to switch without one when the model
takes none. A runtime that cannot resume with another model says so in the menu; add a follow-up
step instead.

## Stop, cancel, resume

- **Stop step** (conversation header) interrupts the live turn. Nothing is closed: the step lands
  _interrupted_ and its queued messages are held until you send a message or resume.
- **Cancel step** (_Steps & sessions_, or the header of a step that has not started) withdraws a
  queued step at once, even while another session runs or its dependency is still open. It stays
  in the plan as _canceled_ with the moment and reason in the history, and it never runs — not
  after a resume, not after a restart. Nothing else changes: the run, its other steps, the branch
  and the worktree stay as they are, and **Add follow-up step** stays available. A step that
  waited on the canceled one stays blocked and says so; cancel it too, or add a step that
  replaces the canceled one. Canceling the last work a run could do is refused: that is
  **Cancel run**.
- **Cancel run** (run actions menu, `⋯`) stops every unfinished step. The branch, the worktree and
  the diff stay exactly as they are.
- An interrupted step resumes with the next message you send. A failed or canceled run is
  **resumed** with **Resume run**, at the bottom of its conversation: Otomat reattaches the
  provider's own session when it still exists, and otherwise opens a recovery session on the same
  step and worktree, with the run's goal, plan, diff and failure as context. The conversation states
  which of the two will happen. A run that finished normally takes new work as a
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
