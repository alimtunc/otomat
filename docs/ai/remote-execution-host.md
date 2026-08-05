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
  with honest typed refusals while that host's tunnel is not connected yet.
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

Updates: the daemon dist bakes its git commit in at build time and reports it
from `/api/health`; the desktop compares it to the build it expects and warns in
Settings on a mismatch. After the files are redeployed, the desktop restarts the
stale daemon **automatically once it has no active runs** — never with work in
flight — so the only manual step is the redeploy itself. (The idle check runs
just before the stop; a resume racing it inside that window can still be cut
and is settled honestly at the daemon's next boot.) While the active host's
daemon is stale, the cockpit **pauses new run launches** (existing runs keep
working and stay resumable): launching would starve the idle restart and speak a
newer API than the old daemon knows.

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

CI publishes this exact deploy for linux-x64 on every pull request and push to
`main` (the `daemon-bundle` job): an artifact named
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

## Desktop implementation

Everything lives in `apps/desktop/src/main/remote/`:

| Module                  | Owns                                                                |
| ----------------------- | ------------------------------------------------------------------- |
| `hosts-config.ts`       | `execution-hosts.json` (alias + active selection), atomic writes     |
| `ssh-config-aliases.ts` | concrete `Host` alias suggestions from `~/.ssh/config`               |
| `ssh.ts`                | one-shot remote scripts over `ssh <alias> bash -ls` (script on stdin)|
| `daemon-bootstrap.ts`   | the start-or-verify script and its single-token outcome parser       |
| `bootstrap-status.ts`   | resolving one start-or-verify round trip into a typed failure or the running-daemon detail |
| `tunnel.ts`             | the `ssh -N -L` child (loopback→loopback, `ExitOnForwardFailure`)    |
| `session.ts`            | phase machine: checking_host → starting_daemon → opening_tunnel → connected, reconnect loop with capped backoff |
| `host-projects.ts`      | `HostCatalog`: aggregated per-host catalog listing + project registration over the host daemon's HTTP API; an unreachable host yields null, logged |
| `manager.ts`            | persisted selection, project-driven switching, boot re-activation, host configure/remove |
| `stale-daemon.ts`       | restarts a redeployed-but-stale remote daemon once it is idle (never with a run in flight; one attempt per observed build) |
| `ipc-actions.ts`        | renderer-facing IPC actions with honest not-ready fallbacks          |

`connected` is declared only after a schema-valid `/api/health` response came
back **through the tunnel**. The tunnel's local port is reserved once per
session and reused across reconnects, so the renderer URL stays stable; an
unexpected tunnel exit enters a visible `reconnecting` loop (1s→15s backoff)
that keeps trying until the user acts or the app quits.

The renderer learns the active host synchronously at preload
(`window.otomat.executionHostId` / `executionHostSshAlias`) and the daemon URL
is simply the tunnel's local origin, so the web app's existing health polling,
offline banner, and SSE resume behave identically for both hosts. Hosts are
managed in Settings → Execution hosts (alias only — the active host follows the
project picked in the switcher); the repository form asks for a path on the
host (the native folder picker is local-only and hidden).

## Known V1 limits

- The Linear key vault pushes credentials to the **local** daemon only; the
  remote daemon has no Linear connection.
- One remote host; changing the alias requires switching to a local project first.
- `Include` directives in `~/.ssh/config` are not parsed for alias suggestions
  (such aliases still work when typed).
