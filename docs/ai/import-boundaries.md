# Otomat Import Boundaries

These rules define the dependency boundaries for the Otomat monorepo. They are
enforced by tooling (`dependency-cruiser`, run inside `pnpm build`), not only by
convention. Config: [`packages/tooling/dependency-cruiser.cjs`](../../packages/tooling/dependency-cruiser.cjs).

## Conceptual Layers

```text
apps/web          -> frontend packages + packages/domain
apps/desktop      -> packages/client + packages/domain, Electron/Node in its own main process
apps/local-daemon -> packages/db + packages/domain, and its own internal modules
packages/domain   -> no app-specific packages
frontend packages -> packages/domain only
packages/db       -> packages/domain only
```

The package layout is flat and intentionally small:

```text
packages/domain     # shared
packages/db         # backend
packages/ui         # frontend
packages/client     # frontend
packages/tooling    # tooling
```

Grouping:

- shared: `domain`
- frontend: `ui`, `client` (and a future `domains`)
- backend: `db` (the only backend package)
- tooling: `tooling`

## Daemon-internal modules

The daemon-only backend lives inside `apps/local-daemon/src/<module>`:
`agents`, `api`, `data-safety`, `events`, `git`, `review`, `runtime`, `supervisor`. They are
**not** packages and carry no `@otomat/*` specifier. Inside the daemon:

- a module is consumed through its public index via a Node subpath import —
  `#agents`, `#api`, `#data-safety`, `#events`, `#git`, `#review`, `#runtime`, `#supervisor` (or
  `#api/<file>` for a specific file);
- imports within a module stay shallow-relative;
- deep relative imports (`../../…`) are banned by oxlint everywhere.

These `#`-imports are declared in `apps/local-daemon/package.json` `imports` and
never cross a package boundary, so `db`/`domain` stay the daemon's only `@otomat/*`
dependencies.

## Allowed App Imports

```text
apps/web
  -> packages/domain
  -> packages/ui
  -> packages/client

apps/local-daemon
  -> packages/domain
  -> packages/db
  -> #agents / #api / #data-safety / #events / #git / #review / #runtime / #supervisor
     (its own internal modules)

apps/desktop
  -> packages/domain
  -> packages/client
  -> its own #main / #preload / #shared modules and Electron/Node APIs
```

The desktop main process launches the daemon as a child process and communicates
through its HTTP contract and narrow preload IPC bridges. It never imports
`packages/db`, imports daemon source, or writes business state directly. Future
mobile code follows the frontend boundary: `domain`, `ui`, and `client`.

## Package Rules

`packages/domain`:

- may depend on small shared runtime libraries such as `zod`;
- must not import React, DOM UI code, Node-only builtins, Drizzle,
  `better-sqlite3`, git/process APIs, HTTP server code, or any app/backend/
  frontend package;
- owns pure TypeScript business types, state machines, event envelope, and zod
  contracts.

Frontend packages (`ui`, `client`):

- may import `packages/domain`;
- must not import `db` or reach into `apps/local-daemon`;
- must not call Linear/GitHub directly. External API mirroring belongs to the
  local daemon.

`packages/db`:

- owns Drizzle schema, migrations, repository helpers, and the isolated
  `better-sqlite3` driver (constructed only in `src/client.ts`);
- may import `packages/domain`;
- must not import frontend packages or contain runtime/git/UI logic.

`apps/local-daemon`:

- composes `db` + `domain` + its internal modules;
- must not import frontend UI packages.

`apps/desktop`:

- may import `domain`, `client`, Electron, and Node APIs in its own process;
- must not import `db` or daemon source;
- owns only desktop lifecycle, local data layout, process launch, diagnostics,
  logs, support export, and narrow renderer IPC.

`packages/tooling`:

- may be referenced by workspace config; must not own product behavior.

## Forbidden Examples

These must fail the boundary lint:

```text
apps/web          -> packages/db
apps/web          -> apps/local-daemon
apps/desktop      -> packages/db
apps/desktop      -> apps/local-daemon
packages/ui       -> packages/db
packages/client   -> apps/local-daemon
packages/db       -> packages/ui
packages/domain   -> packages/db
packages/domain   -> React
```

## Adding a backend or frontend package later

A new package must earn its place (multiple consumers, a boundary to protect, a
heavy dependency to isolate, a stable cross-world interface, or planned cross-app
reuse). When that bar is met, add its name to the `BACKEND`/`FRONTEND` regex in
`dependency-cruiser.cjs` and record the justification in the owning ticket. Until
then, daemon-only code stays a module inside `apps/local-daemon`.
