# Conversations

**Conversations**, in the sidebar's Workspace section, lists every step conversation of every
project on the active host — the threads the run cockpit already shows, gathered in one place so
you can find the one that spoke last and answer it without opening the right run first.

## The list

One row per step that has a session or a message, grouped by issue, newest activity first, in
two sections. **Active** holds the issues whose cycle is still open: a run queued, working or
waiting on a permission, an answer or a provider quota; a run awaiting your review or with an
open pull request; a stopped run you can still resume. **Recently finished** holds the issues
with nothing left to follow — merged, abandoned, closed at the tracker, or a stop whose workspace
is gone — for the threads that moved in the last day, ten issues at most. A finished thread you
have not read keeps its unread dot there; it never holds an issue in Active.

Each group names the issue and shows its cycle as the icon the board uses for it; click the
heading to fold or unfold its threads — the open thread stays open. Each row names the step,
its state as an icon (hover it for the word), the last line of the thread — a pending
permission or question first, then a message waiting to be delivered, then the last thing said —
its runtime and model, and how long ago it moved.

A thread is **unread** when an agent answered, a question was asked, a message failed to deliver
or the step reached an actionable state — a permission, a question, a quota wait, a failure or a
success — since you last had it open. Tool calls, reasoning and logs never make a thread unread,
and the sidebar badge counts threads, not messages. A step you cancelled and a run you abandoned
are never news.

**Filters** narrow the list by state (active, waiting on you, finished), to unread threads only,
or by project. Archived threads stay hidden until they speak again.

## Reading and answering

Selecting a row opens its thread on the right: the same header, messages, question cards and
composer as the run cockpit, aimed at that exact step. The composer names its recipient and says
when the message will be delivered; a finished step explains why it can no longer take one and
links to the run to append a follow-up step. **Open issue** and **Open cockpit** lead to the
surfaces that hold the plan, the diff and the pull request.

Opening a thread marks it read while the window is visible; a thread open in a hidden window
stays unread. **Mark as unread** and **Archive** on a row, or `u` and `e` on a focused row, are
reading marks like the Inbox's — they change nothing on the run or the step. `↑` and `↓` walk
the rows.

The selection lives in the URL, so a refresh, a shared link or a notification lands on the same
thread. A host that stops answering keeps its last list on screen behind a stale notice; marks
and messages wait until it answers again.
