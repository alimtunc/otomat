# Otomat Import Boundaries

These rules define the dependency boundaries for the Otomat monorepo. They are
enforced by tooling (`dependency-cruiser`, run inside `pnpm build`), not only by
convention. Config: [`packages/tooling/dependency-cruiser.cjs`](../../packages/tooling/dependency-cruiser.cjs).

## Conceptual Layers

```text
apps/web          -> frontend packages + packages/domain
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
`api`, `events`, `git`, `review`, `runtime`, `supervisor`. They are **not**
packages and carry no `@otomat/*` specifier. Inside the daemon:

- a module is consumed through its public index via a Node subpath import —
  `#api`, `#events`, `#git`, `#review`, `#runtime`, `#supervisor` (or
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
  -> #api / #events / #git / #review / #runtime / #supervisor   (its own internal modules)
```

Future apps (`desktop`, `mobile`) follow `apps/web`: `domain`, `ui`, `client`
(+ a daemon launcher for `desktop`). They never import a backend package or reach
into `apps/local-daemon`.

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

`packages/tooling`:

- may be referenced by workspace config; must not own product behavior.

## Forbidden Examples

These must fail the boundary lint:

```text
apps/web          -> packages/db
apps/web          -> apps/local-daemon
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
