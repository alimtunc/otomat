# GitHub Pull-Request Sync

How the Reviews inbox stays current, and the conditions under which polling stops
being the right answer.

## V1: the daemon pulls, and only while asked

The local daemon is not publicly reachable, so nothing on GitHub can call it. V1
therefore pulls, and only when a person is looking:

- **Opening or refocusing Reviews** reconciles the project, and so does a manual
  **Refresh**. `usePullRequestInboxSync` collapses concurrent triggers into one
  request and skips a pass whose last success is under a minute old.
- **A background pass runs every two minutes**, and only while the view is
  mounted. Closing Reviews stops it; nothing polls GitHub in the background of
  the app.
- **A pass is metadata only.** `gh pr list --state open` reads one page per
  repository, then every locally live row GitHub stopped listing is re-read with
  `gh pr view` so a merge or a close settles here too. The head of a pull request
  is fetched when a reviewer opens it, never once per open pull request.
- **Freshness is durable, failure is not.** `sync_state` records
  `last_synced_at` per repository; whether a pass is in flight and how the last
  one ended live in memory and die with the process.
- **A failed pass keeps the rows it had.** The daemon answers the inbox it
  already held with `sync.last_error` set, so Reviews shows its entries under a
  stale notice with Retry instead of emptying.

## What this costs

One `gh pr list` per repository per pass, plus one `gh pr view` per pull request
that left the open list since the previous pass, plus one `gh api user/teams`.
For a project with one repository and a normal open-pull-request count, that is
two to three GitHub calls a minute while Reviews is open, and none when it is
closed.

## When a webhook or a GitHub App becomes preferable

Polling is right while the daemon is local, single-operator and only current
while someone watches. Reach for push delivery when one of these becomes true:

- **Latency has to be sub-minute** — a reviewer must see a request the moment it
  is made, not at the next pass. Only a webhook removes the interval.
- **Reviews has to be current while it is closed** — a badge that must count
  correctly without the view being open, or a desktop notification (OTO-34),
  cannot rest on a pass that stops with the view.
- **Repository count or open-pull-request volume grows** — the pass is linear in
  repositories, and each one is a page read in full. Past roughly a dozen active
  repositories the poll is doing far more work than the change rate justifies.
- **Rate limits start being felt** — a shared or CI-driven token, or several
  daemons on one account, make an event stream cheaper than repeated listing.
- **Otomat needs to act as an app rather than as a person** — a GitHub App has
  its own installation token, finer permissions and its own rate limit, and
  removes the dependency on the operator's `gh` login and its `read:org` scope
  (which is what today lets team review requests be matched at all).

Both require a publicly reachable endpoint that the local-first daemon does not
have: a hosted relay the daemon subscribes to, or a tunnel. That relay — not the
webhook itself — is the real cost, and it is the reason V1 does not attempt one.
