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
  SQLite databases. When the remote host is selected, the cockpit reads only the
  remote daemon's persistent state; switching hosts reloads the renderer against
  the other daemon. A failed remote connection never silently falls back to the
  local daemon — the selection is unchanged and the failure is shown.

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
PATH, `git`, and the agent CLIs (`claude`, `codex`) for the runtimes you intend
to use. The daemon is started with `nohup`, detached from the ssh session, so it
survives disconnects and app quits; quitting the desktop app closes the tunnel
but **never stops the remote daemon**. After a host reboot, the next connect
starts it again.

Deploying the daemon onto the host (from a checkout, on the host or any
same-arch Linux):

```bash
pnpm install && pnpm build
pnpm --filter @otomat/local-daemon deploy --prod --legacy ~/.otomat/daemon
```

If the deploy machine's architecture differs from the host's, run the deploy on
the host itself (`better-sqlite3` is a native module).

## Desktop implementation

Everything lives in `apps/desktop/src/main/remote/`:

| Module                  | Owns                                                                |
| ----------------------- | ------------------------------------------------------------------- |
| `hosts-config.ts`       | `execution-hosts.json` (alias + active selection), atomic writes     |
| `ssh-config-aliases.ts` | concrete `Host` alias suggestions from `~/.ssh/config`               |
| `ssh.ts`                | one-shot remote scripts over `ssh <alias> bash -ls` (script on stdin)|
| `daemon-bootstrap.ts`   | the start-or-verify script and its single-token outcome parser       |
| `tunnel.ts`             | the `ssh -N -L` child (loopback→loopback, `ExitOnForwardFailure`)    |
| `session.ts`            | phase machine: checking_host → starting_daemon → opening_tunnel → connected, reconnect loop with capped backoff |
| `manager.ts`            | persisted selection, explicit switching, boot re-activation          |
| `ipc-actions.ts`        | renderer-facing IPC actions with honest not-ready fallbacks          |

`connected` is declared only after a schema-valid `/api/health` response came
back **through the tunnel**. The tunnel's local port is reserved once per
session and reused across reconnects, so the renderer URL stays stable; an
unexpected tunnel exit enters a visible `reconnecting` loop (1s→15s backoff)
that keeps trying until the user acts or the app quits.

The renderer learns the active host synchronously at preload
(`window.otomat.executionHostId` / `executionHostSshAlias`) and the daemon URL
is simply the tunnel's local origin, so the web app's existing health polling,
offline banner, and SSE resume behave identically for both hosts. Host
selection UI lives in Settings → Execution host; the repository form asks for a
path on the host (the native folder picker is local-only and hidden).

## Known V1 limits

- The Linear key vault pushes credentials to the **local** daemon only; the
  remote daemon has no Linear connection.
- One remote host; changing the alias requires switching back to local first.
- `Include` directives in `~/.ssh/config` are not parsed for alias suggestions
  (such aliases still work when typed).
