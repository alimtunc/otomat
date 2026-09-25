# Conversations

**Conversations**, directly below Inbox in the sidebar, lists every step conversation of every
project on the active host — the threads the run cockpit already shows, gathered in one place so
you can find the one that spoke last and answer it without opening the right run first.

## The list

Conversations are grouped by issue, newest activity first, in two sections. **Following**
holds the issues whose cycle is still open: a run queued, working or
waiting on a permission, an answer or a provider quota; a run awaiting your review or with an
open pull request; a stopped run you can still resume. **Recently finished** holds the issues
with nothing left to follow — merged, abandoned, closed at the tracker, or a stop whose workspace
is gone — for the threads that moved in the last day, ten issues at most. A finished thread you
have not read stays unread there; it never holds an issue in Following. Recently finished is
collapsed by default, with its unread count still visible in the heading.

A single-conversation issue opens directly from its row. Issues with several conversations
stay open while one of their steps is running and fold again when none is; click a heading to
fold or unfold it yourself, and your choice holds while you stay on the page. Folding a group or
section leaves the open thread on screen. Each row shows a short preview — a pending permission
or question first, then a message waiting to be delivered, then the last thing said — and how
long ago it moved. Running, waiting and failed steps have a named status; a running one spins
while the agent works, including a completed step answering a message you sent it. Completed
steps need no badge.
The selected row keeps a tinted background and a left-edge marker when the pointer moves away.

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
when the message will be delivered; a step that can no longer take one says why, and a finished
run offers to add a follow-up step in place. Runtime and model details appear here.
**Open issue** and **Open cockpit** lead to the surfaces that hold the plan, the diff and the
pull request.

Opening a thread marks it read while the window is visible; a thread open in a hidden window
stays unread. **Mark as unread** and **Archive** in a row's `…` menu, or `u` and `e` on a focused row, are
reading marks like the Inbox's — they change nothing on the run or the step. `↑` and `↓` walk
the rows.

The selection lives in the URL, so a refresh, a shared link or a notification lands on the same
thread and reveals its group and section. A host that stops answering keeps its last list on
screen behind a stale notice; marks and messages wait until it answers again.
