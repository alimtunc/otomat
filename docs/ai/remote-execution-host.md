# Remote SSH Execution Host (V1)

Otomat can run its daemon — and therefore repositories, worktrees, the SQLite
database, and the agent runtimes — on a server the user owns, while the Electron
desktop app stays the UI. This document is the contract for that mode.

## Model

- The remote host is **user-owned and preconfigured** (V1 targets one host such
  as `otomat-vps`). No marketplace, no fleet management, no generic SSH client.
- The desktop app connects with the system `ssh` binary using a **concrete
  `Host` alias from `~/.ssh/config`**. Otomat stores only the alias string
  (`execution-hosts.json` in the app data root) — never passwords, keys, or
  tokens. Every ssh invocation uses `BatchMode=yes`, so nothing ever prompts;
  authentication must already work from a terminal (`ssh otomat-vps`), including
  a host key that has been accepted once.
- The remote daemon binds **loopback only** (`127.0.0.1:4319`). No API port is
  ever exposed publicly; the desktop reaches it through `ssh -N -L
  127.0.0.1:<local>:127.0.0.1:4319`, and the daemon's loopback `Host`-header
  guard and CORS behavior apply unchanged.
- **No state synchronization.** The local and remote daemons own separate
  SQLite databases. When the remote host is active, the cockpit reads only the
  remote daemon's persistent state; switching hosts reloads the renderer against
  the other daemon. A failed remote connection never silently falls back to the
  local daemon — the selection is unchanged and the failure is shown.
- **The host follows the project.** The project switcher aggregates both hosts'
  project catalogs (fetched by the main process, badged per host); picking a
  project on the other host persists the choice and re-points the renderer at
  that host's daemon. There is no separate host switch in Settings — it only
  manages the host list and the SSH alias. When an alias is configured, the
  tunnel is warmed in the background at boot (and kept alive on a switch to
  local) so the other host's projects stay listable.
- **Projects are managed from the switcher, on either host.** "Add project…"
  registers a repository path on the chosen host's daemon over its HTTP API,
  with honest typed refusals while that host's tunnel is not connected yet. For
  the remote host it first offers the host's own git working trees, listed over
  one bounded ssh round trip (`host/repos.ts`: `find` under `$HOME`, depth ≤ 4,
  heavy directories pruned, END token). Picking one fills the path; the free
  path field stays for anything the walk cannot see. A listing that never
  completed is an error, never an empty list.
  Projects whose daemon reports `has_repository: false` (the auto-created
  bootstrap project before any repository is registered) are hidden from the
  switcher. "Remove host" only forgets the alias and closes the tunnel — the
  remote daemon and its data stay on the server.

## Host conventions

The desktop's start-or-verify step (one ssh round trip at every connect) expects:

```text
~/.otomat/
  daemon/dist/index.js   # self-contained daemon deploy (see below)
  data/otomat.db         # SQLite; runs/, worktrees/ live beside it
  daemon.log             # appended by the daemon process
  daemon.pid             # written when the desktop starts the daemon
```

Requirements on the host: Linux with `bash`, Node.js >= 22 on the login-shell
PATH, `git`, the GitHub CLI (`gh` >= 2.63) for GitHub connection and PR
publication, and the agent CLIs (`claude`, `codex`) for the runtimes you intend
to use. The daemon is started with `nohup`, detached from the ssh session, so it
survives disconnects and app quits; quitting the desktop app closes the tunnel
but **never stops the remote daemon**. After a host reboot, the next connect
starts it again.

Which daemon a desktop app drives is decided by its channel
([distribution channels](../release/macos-alpha.md#distribution-channels)), never by its signature:

| Channel | Deployment | Port |
| --- | --- | --- |
| `stable`, `dev` | `~/.otomat` | 4319 |
| `local` | `~/.otomat/local` | 4320 |
| `preview` | `~/.otomat/instances/<sha7>` | derived from the sha |
| `unknown` | `~/.otomat/instances/unknown` | derived from `unknown` |

`local` and `stable` keep one deployment each, so their databases outlive every new build of the
app; a preview is isolated per build, and a packaged build that could not name its channel shares
the `unknown` slot rather than ever falling back to a deployment that holds real work. A dev
checkout drives `~/.otomat` on purpose: exercising the real deployment is what a checkout is for,
and it takes the same protected upgrade path the stable app does on that deployment.

Updates: the daemon dist bakes its git commit in at build time and reports it
from `/api/health`; the desktop compares it to the build it expects and, on a
mismatch, **installs that exact build itself** — no Settings visit, no manual
deploy. While the active host's daemon is stale, the cockpit **pauses new run
launches** (existing runs keep working and stay resumable): launching would
delay the update indefinitely and speak a newer API than the old daemon knows.

Deploying the daemon onto the host (from a checkout, on the host or any
same-arch Linux):

```bash
pnpm install && pnpm build
rm -rf ~/.otomat/daemon
pnpm --filter @otomat/local-daemon deploy --prod --legacy ~/.otomat/daemon
find ~/.otomat/daemon -type f -links +1 \
  -exec sh -c 'cp -p "$1" "$1.t" && mv "$1.t" "$1"' _ {} \;
```

The `find` pass is not optional when the checkout lives on the same filesystem:
`pnpm deploy` hardlinks workspace package files into the target, so a later
`pnpm build` in the checkout mutates the deployed daemon **in place** — new
files never appear while shared ones change, leaving a torn deploy that crashes
at import time. Breaking the links gives the deploy its own inodes.

If the deploy machine's architecture differs from the host's, run the deploy on
the host itself (`better-sqlite3` is a native module).

CI publishes this exact deploy for linux-x64 on every push to `main` (the
`daemon-bundle` job): an artifact named
`otomat-daemon-<short-sha>-linux-x64`, kept 7 days, boot-smoked to `/api/health`
before upload. On a host with `gh` authenticated, updating is a download instead
of a build:

```bash
gh run download <run-id> -R <owner>/<repo> -n otomat-daemon-<short-sha>-linux-x64 -D /tmp/otomat-daemon
rm -rf ~/.otomat/daemon
tar -xzf /tmp/otomat-daemon/otomat-daemon-<short-sha>-linux-x64.tar.gz -C ~/.otomat
```

The tarball's files own their inodes, so the hardlink `find` pass above does not
apply. The artifact is only a file — nothing starts a daemon from it, and the
idle restart above applies unchanged.

## One journey: connect, check the build, install it

A host reaches `connected` and its build is checked in the same state machine, because installing a
daemon stops and restarts the tunnel: split in two, a normal upgrade would read as a lost host.
`RemoteHostStatus` is that machine — `checking_host → starting_daemon → opening_tunnel`, then
`checking_version → waiting_for_runs → waiting_for_artifact → installing_update → verifying_update`,
then `connected` — and `ExecutionHostManager.remoteStatus` composes it from one place: the update
owns the status while it runs, the session speaks for itself otherwise.

`upgrade/coordinator.ts` drives the daemon half from **every** `connected` transition, so a client
closed mid-wait picks the journey back up on its next launch, and nothing has to be scheduled:

1. **Compare** the build `/api/health` reported against the one this app expects. Equal, unstamped,
   or already attempted and failed: nothing happens.
2. **Wait** while `/api/runs` reports work in flight, saying how many runs it is holding for and
   re-checking every 15s. Busy, refusing, unreadable and unreachable all count as "not idle" — an
   absent answer is never taken for an empty one. Meanwhile the cockpit refuses new launches, so the
   queue drains instead of postponing the update forever. No run is ever interrupted.
3. **Wait for the bundle** through `upgrade/artifact.ts`, a read-only `gh` round trip made *before*
   anything is stopped: the artifact by name — skipping the expired entries the listing keeps
   returning after their content is gone — and when it is not there yet, the run of the workflow
   that publishes it (`ci.yml`, `event=push`; a tag release or a PR run must never answer for a
   bundle they do not build) whose `head_sha` starts with that sha7, since the API's own filter
   needs the full sha this app cannot name. A run queued, in flight, or green but still uploading is
   `waiting_for_artifact` — progress, not a failure — re-checked on `artifact-wait.ts`'s bounded
   backoff (10s→90s, ~2 min for a run that never appears or a bundle that never lands, ~17 min for
   CI itself, and 24 checks — ~32 min — per build, so no sequence of reasons can wait on forever). A
   probe the host could not answer at all is held the same way for three checks: one ssh or `gh`
   blip must not cost the no-click install. Each re-check re-drives the whole journey, so a run
   started meanwhile blocks the install again. Merging and opening the client before CI ends is the
   nominal path, and it installs itself with no click.
4. **Install** through `upgrade/daemon.ts` (below), which is also what the manual command runs.
5. **Fail once, loudly.** A workflow that failed or was cancelled, a run that never appeared, a
   green run that published no bundle, a host that stayed unable to ask, an unusable `gh` — each
   ends the journey with its own sentence against the build that stayed running, and is never
   retried automatically for that build. The reason rides on the host snapshot as
   `remote_update_error`, and *Settings → Execution hosts* shows it with an **Install
   &lt;build&gt; now** button — the retry for a cause the user has fixed (a re-run CI job, an
   authenticated `gh`), not the nominal path.

`remote/upgrade/daemon.ts` is the one install protocol, for every deployment, and refuses the moment
a step is not certain. Its caller owns the idle gate: it stops whatever is running.

0. **Is there a daemon at all?** When the session is not connected, one script looks for the
   deployment's entry file — it starts, stops and reads nothing else. Only an answer that says
   *absent* licenses a plain first install (nothing to stop, no database of ours to protect, the
   same provisioning a preview instance gets). *Present*, or a host that cannot say, is refused.
1. **Stop**, by pidfile pid whose `cmdline` still proves it is that daemon.
2. **Back up** where the data outlives the bundle (`keepsDataAcrossBuilds`: `~/.otomat` and
   `~/.otomat/local`), in the same round trip so the copy is taken from a stopped database:
   `otomat.db` plus any `-wal`/`-shm` into `<deployment>/backups/upgrade-<timestamp>/`, flushed with
   `sync`. Nothing prunes it. A backup that fails ends the upgrade with the old daemon restarted. A
   preview instance skips this step: its data is a test bed. The deployment decides, not the channel
   that picked it, so a checkout cannot swap a bundle under the daemon real work runs on unprotected.
3. **Swap** the CI bundle — `otomat-daemon-<build>-linux-x64`, found by name through the host's own
   authenticated `gh` — in atomically, keeping the bundle it displaced as `daemon.prev`.
4. **Migrate**, by restarting: the new daemon runs the same data-safety policy as the local one —
   pre-migration backup, then a refusal rather than a partial schema.
5. **Verify**: `connected` again, and `/api/health` naming the build that was just installed.
6. **Roll back** otherwise: `daemon.prev` goes back (the bundle that failed is kept as
   `daemon.failed` for a support bundle), the session reconnects to it, and the failure names the
   backup path. Every failure after step 1 leaves a running daemon.

## A startup that stays quiet

Establishing a remote session takes 20–30 seconds, and an update adds a restart to it. Nothing in
that window is a failure, so nothing renders as one. `isRemoteHostSettling` (in the domain, beside
the phases) is the single predicate: while it holds, the cockpit keeps the cache it already has,
`QueryBoundary`/`QueryList` stay on their pending slot instead of mounting a generic error, and the
shell shows a compact progress line — *Connecting to otomat-vps…*, *Checking the daemon version…*,
*Installing the daemon update…*, *Restarting and verifying the daemon…* — instead of `Offline`.

The two waits are the journey phases the predicate leaves out, because they are the ones where
nothing is coming up: the tunnel serves the cockpit throughout them, and they last as long as the
runs — or CI — do. Holding every query on its pending slot for that long would hide real failures,
so a wait is reported where it is actionable instead — *Update waiting on 2 runs…* and *Waiting for
the CI artifact… — its CI run is still running* in the update panel, plus the paused-launch panel.

A real offline state is only reached after a terminal failure. The session's reconnect loop keeps
running past its schedule, but once the schedule is exhausted (1s→15s, five attempts) it reports the
coded error instead of another "reconnecting", and stops flickering progress over it: a host that
will never come up says why, with its diagnostics and a Retry, rather than spinning forever.

Runs are never the price of any of this. A remote run does not depend on the client once started, so
closing the app leaves it running, an update waits for it, and reopening finds it again. That is
said where it is relevant — the connection popover, the update panel, the paused-launch panel — and
never as a quit confirmation, because closing the app destroys nothing.

## Test instances

A packaged preview build never touches `~/.otomat` or `~/.otomat/local`: it targets its own
deployment under `~/.otomat/instances/<sha7>/` — keyed by the build it expects,
`unknown` for an unidentifiable one — with a port derived from the same key
(`instanceDeployment` in `bootstrap/scripts.ts`). The entire journey above
(start-or-verify, tunnel, version check, install) applies unchanged to that
deployment, so testing an artifact runs beside the daemon real work runs on,
never inside it.

An instance also gets the preview's sandbox: on the first connect, the desktop
creates the same fixture repository as the local sandbox **inside the instance
directory** (`~/.otomat/instances/<sha7>/test-repo`, one ssh script — files by
heredoc, `git init -b main` and a commit under an explicit identity) and seeds
its issues through the tunnel with the daemon's public HTTP API. Both halves are
idempotent (an already committed repository is left alone; a 409 registration
means the issues are already there), so a reconnect costs one round trip and
changes nothing. Because everything lives inside the instance directory —
daemon, data, worktrees, fixture repository — **Delete** on the panel below
removes every trace of that build from the host in one action.

*Settings → Execution hosts → Deployments on this host* lists the instances
(build, running state, port, size) with explicit **Stop** and **Delete**
actions. Installing a build is not one of them: that is the *Daemon build*
panel above, on whichever deployment this app drives. The install runs `gh` on
the host — already authenticated there — so no artifact ever transits the
desktop.

## Linear across hosts

The Linear workspace is connected **once for the app**, not per host. The
Personal API key is stored only in this Mac's Electron `safeStorage` vault
(`linear-credential.enc` in the app data root) — never in SQLite, never in a log
or support bundle, and never written to disk on the server. Each host's daemon
receives it over
that host's own HTTP API (`POST /api/linear/connect`, through the SSH tunnel for
a remote host) and keeps it **in memory only**, so nothing ever puts the key in
an ssh command, its arguments, its environment, or a remote script.

`LinearCoordinator` (`main/linear/coordinator.ts`) owns the fan-out over a
serialized queue, against the target list `main/linear/targets.ts` derives from
the host manager — the local daemon, plus the configured remote host whenever an
alias is set, carrying the reason it cannot be reached while its tunnel is down.
Its rules:

- **Save** pushes to every reachable host and stores the key only once at least
  one daemon validated it against Linear. An unreachable host does not fail the
  save; it is left `pending_restore` and served on its next connection.
- **Reconcile** runs at boot, when a fresh local daemon starts, and every time a
  remote host reaches `connected`. It reads each daemon's own
  `/api/linear/connection` first — the only thing that survives that daemon's
  restart — then delivers the vault key, or revokes what is still there when the
  vault is empty. Revocation is applied before anything re-exposes Linear on
  that host.
- **Forget** erases the vault and disconnects every reachable host. A host that
  could not be reached is recorded `pending_revocation` and the result says so:
  the app never claims a complete disconnection while a known host is still
  owed one.
- Per-host state (`delivered`, `cleared`, `pending_restore`,
  `pending_revocation`, `unavailable`) is pushed to the cockpit and shown under
  *Settings → Integrations*. A confirmed state is only ever reported for a host
  that answered; an unreachable host reports what it is still owed.

Import stays a per-project act on that project's own host: teams, projects and
issues come from the daemon the cockpit is pointed at, which is the daemon of
the project picked in the switcher. The two SQLite databases are never synced,
copied or merged, and a run always executes on the host owning its project.

## Desktop implementation

Everything lives in `apps/desktop/src/main/remote/`:

| Module                     | Owns                                                                |
| -------------------------- | ------------------------------------------------------------------- |
| `host/config.ts`           | `execution-hosts.json` (alias + active selection), atomic writes     |
| `ssh/config-aliases.ts`    | concrete `Host` alias suggestions from `~/.ssh/config`               |
| `ssh/script.ts`            | one-shot remote scripts over `ssh <alias> bash -ls` (script on stdin)|
| `bootstrap/scripts.ts`     | the start-or-verify and stop scripts, `deploymentForChannel` (which home + port a channel drives) and `keepsDataAcrossBuilds` (which of them an update must protect) |
| `idle.ts`                  | the one read of the runs in flight every stop goes through; an unreadable answer is never zero |
| `deploy.ts`                | the one CI-bundle install both the preview deploy and the in-place upgrade run; starts nothing |
| `bootstrap/status.ts`      | resolving one start-or-verify round trip into a typed failure or the running-daemon detail |
| `ssh/tunnel.ts`            | the `ssh -N -L` child (loopback→loopback, `ExitOnForwardFailure`)    |
| `session.ts`               | the transport half of the phase machine: checking_host → starting_daemon → opening_tunnel → connected |
| `reconnect.ts`             | the capped backoff, and the attempt at which a retrying session names its failure instead |
| `host/projects.ts`         | `HostCatalog`: aggregated per-host catalog listing + project registration over the host daemon's HTTP API; an unreachable host yields null, logged |
| `host/alias.ts`            | ssh alias validation (one concrete word, never a leading `-`) and the alias listing that degrades to empty when `~/.ssh/config` cannot be read |
| `host/repos.ts`            | the bounded `$HOME` git-repository walk behind the remote picker; a listing counts only with its END token |
| `manager.ts`               | persisted selection, project-driven switching, boot re-activation, host configure/remove, and the one composition of session + update into the host's status |
| `host/snapshot.ts`         | the host list and remote standing every surface reads, including the not-ready shell's |
| `upgrade/coordinator.ts`   | the update half of the journey: version check, idle wait with its run count, artifact wait, install, one automatic attempt per stale build once something has gone wrong |
| `upgrade/artifact.ts`      | the read-only probe that tells a bundle CI has not published *yet* from one that will never come, and the wording of both |
| `upgrade/artifact-wait.ts` | the bounded backoff behind that wait: a window per reason, a ceiling per build, then a terminal answer |
| `instances/scripts.ts`     | deploy/list/delete scripts for `~/.otomat/instances`; a listing counts only with its END token |
| `instances/actions.ts`     | one-shot list/stop/delete actions; keys regex-validated before any interpolation, never on a timer |
| `upgrade/scripts.ts`       | the pre-upgrade database backup and the bundle rollback, with their parsers |
| `upgrade/daemon.ts`        | the one install protocol — stop, backup where the data outlives the bundle, swap, restart, verify, roll back |
| `ipc-actions.ts`           | renderer-facing IPC actions with honest not-ready fallbacks          |

`connected` is declared only after a schema-valid `/api/health` response came
back **through the tunnel**. The tunnel's local port is reserved once per
session and reused across reconnects, so the renderer URL stays stable; an
unexpected tunnel exit enters a visible `reconnecting` loop (1s→15s backoff)
that keeps trying until the user acts or the app quits.

The renderer learns the active host synchronously at preload
(`window.otomat.executionHostId` / `executionHostSshAlias`) and the daemon URL
is simply the tunnel's local origin, so the web app's health polling and SSE
resume behave identically for both hosts. What the host status adds is
knowing when a failed poll is only a bootstrap: `RemoteSessionProvider`
(`apps/web/src/components/shell/remote-session/`) holds the single subscription
to it, and every surface reads that one state — the shell's connection line, the
query boundaries, the launch gate, Settings. Hosts are managed in Settings →
Execution hosts (alias only — the active host follows the project picked in the
switcher); the repository form lists the host's own repositories and keeps a
path field (the native folder picker is local-only and hidden).

## Known V1 limits

- Removing the remote host — or repointing its alias — drops it from the Linear
  fan-out before anything revokes it, so that daemon keeps the key in memory
  until it restarts. Disconnect Linear first.
- One remote host; changing the alias requires switching to a local project first.
- `Include` directives in `~/.ssh/config` are not parsed for alias suggestions
  (such aliases still work when typed).
