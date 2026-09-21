# Conversations

**Conversations**, in the sidebar next to the Inbox, lists every step conversation of every
project on the active host — the threads the run cockpit already shows, gathered in one place so
you can find the one that spoke last and answer it without opening the right run first.

## The list

One row per step that has a session or a message, newest activity first, in two sections:
**Active** holds the steps still working or waiting, plus any finished thread you have not read
yet; **Recently finished** holds the settled threads of the last day once you have read them.
Each row names the issue, the step, its state, the last line of the thread — a pending
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
