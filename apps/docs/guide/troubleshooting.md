# Troubleshooting

Otomat never shows a bare error. Every failure is classified — in the app, in the daemon, or on the
way between them — and carries the details behind **Copy diagnostic**, **Report a problem** and
**Retry**. Most refusals name the action that clears them; this page covers the ones that need
context.

## The app does not start

| Message                                             | Cause and fix                                                                                                                                                                                                                            |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _Not enough free disk space_                        | Otomat refuses to start with less than 16 MiB free rather than risk the database. Free space and relaunch.                                                                                                                               |
| _Data directory created by an incompatible version_ | The data was written by a newer Otomat. Install that version, or quit and restore the matching [backup](./data-and-security.md#backups) by hand; **Restore Backup** is only offered for a corrupt, missing or failed-migration database. |
| _Database migration failed_                         | **Restore Backup** puts the pre-migration [backup](./data-and-security.md#backups) back; report the failure with a support bundle.                                                                                                       |
| _The local daemon could not be started_             | Read the daemon log under `~/Library/Application Support/Otomat/logs`, or export a support bundle.                                                                                                                                       |

## A runtime or tool is not detected

- _Settings → Reference → Runtimes_ shows what the active host's daemon found. Otomat reads your
  [login shell's `PATH`](./install.md#install) — a CLI installed for one shell only (a
  `.zshrc`-only path, a version manager not initialised for login shells) is invisible from a
  Finder launch. Fix the login shell, then relaunch Otomat.
- A model or option missing from the pickers is one the installed CLI does not announce. Update
  the CLI; Otomat re-reads it on the next launch.
- **GitHub CLI not installed**, **too old** or **not connected**: see
  [GitHub CLI](./prerequisites.md#github-cli), then reopen the PR tab.
- Codex on a Linux host refuses its confined sandboxes when the host cannot start Codex's
  namespace sandbox. The refusal reports what it tried; enable user namespaces on the host — Otomat
  never substitutes an unconfined mode.

## A launch is refused

| Reason                                     | What to do                                                                                                                                                                        |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The issue already has an open workspace    | [One issue, one workspace](./runs.md#one-issue-one-workspace): add a follow-up step to the existing run, or abandon its workspace first.                                          |
| The base branch's remote could not be read | The refusal says whether the remote was unreachable, refused access or has no such branch ([why the remote](./runs.md#a-single-run)); fix it and **Retry** — nothing was created. |
| Launches are paused                        | The app is about to update the host's daemon, or an update of the app is armed. Let the runs finish; launches reopen by themselves.                                               |
| Queued                                     | Every session slot is taken; raise the [host's limit](./runs.md#what-happens-next) or wait.                                                                                       |
| A profile's skill is missing               | The profile still lists the skill with the reason; fix the file or remove it from the profile.                                                                                    |

## A run stopped

- **Interrupted** — the daemon or the provider process stopped mid-turn (a crash, a quit, **Stop
  step**). Send a message to [resume](./steering.md#stop-cancel-resume).
- **Failed** — open the failing step; its last messages and the provider's own error are there.
  The branch and the worktree are intact; resume, add a step, or abandon.
- **Waiting on provider** — the provider's quota is exhausted; Otomat
  [resumes by itself](./runs.md#what-happens-next).
- A permission or question left unanswered when the turn ended holds the dependent steps:
  [answer it, or accept the step anyway](./steering.md#questions-and-permissions).

## Pull requests

- **Publication interrupted** — the daemon stopped during a publication. **Retry publication** is
  [safe to repeat](./review.md#open-a-pull-request).
- **Push rejected** — the remote branch moved. The PR tab offers
  [**Force push with lease**](./review.md#keep-the-pull-request-current).
- **Cannot publish** with a partially staged worktree — a manual staging selection is never
  replaced silently. **Open changes**, commit the selection or stage the rest, then retry.
- The diff counts far more files than GitHub — Otomat compares against the later of the local and
  the published fork point of the base branch, so this only happens when neither can be read (a
  base branch with no upstream, a remote that cannot be reached). `git fetch` in the repository,
  then refresh.

## Remote hosts

- _Connecting…_ for more than a minute, then offline: run `ssh <alias>` in a terminal; any prompt
  — a passphrase, an unaccepted host key — is a failure in
  [batch mode](./projects.md#add-a-vps-as-an-execution-host). Fix it there, then **Retry**.
- _Waiting for the CI artifact…_ — the daemon build this app expects has not been published yet
  or the host's `gh` cannot read it. CI publishes it on every push to `main`; the wait is bounded
  and the failure, if any, is shown with an **Install … now** retry once you fixed the cause.
- _Update waiting on N runs…_ — the daemon is not replaced under a running agent. Let them finish.
- Linear **Key not on this host** — the key never reached that daemon; reconnect from _Settings →
  Integrations_. **Access refused** — Linear rejected the key; rotate it.

## Collect a support bundle

**Data Safety → Export Support Bundle…** in the menu bar writes one JSON file
([what it contains](./data-and-security.md#logs-and-support-bundles)). When an error report offers
**Export**, the bundle also carries that incident.

`versions.commit` is how a bug report identifies its build; `versions.channel` says whether it was
the release, a local package or a preview.

Bugs and questions go to the
[GitHub issue tracker](https://github.com/alimtunc/otomat/issues).
