# Otomat Import Boundaries

These rules define the dependency boundaries for the Otomat monorepo. They must
be enforced by tooling, not only by convention. OTO-5 should wire a boundary
check into the build with `dependency-cruiser` or `eslint-plugin-boundaries`.

## Conceptual Layers

```text
apps/web          -> frontend packages + packages/domain
apps/local-daemon -> backend packages + packages/domain
packages/domain   -> no app-specific packages
frontend packages -> packages/domain only
backend packages  -> packages/domain only, unless a later ticket explicitly widens the rule
```

The flat package layout is intentional:

```text
packages/domain
packages/db
packages/tooling
packages/runtime
packages/events
packages/git
packages/api
packages/ui
packages/client
packages/domains
packages/supervisor
packages/integrations
packages/review
```

The grouping is conceptual:

- shared: `domain`
- frontend: `ui`, `client`, `domains`
- backend: `db`, `runtime`, `events`, `git`, `api`, `supervisor`,
  `integrations`, `review`
- tooling: `tooling`

## Allowed App Imports

```text
apps/web
  -> packages/domain
  -> packages/ui
  -> packages/client
  -> packages/domains

apps/local-daemon
  -> packages/domain
  -> packages/db
  -> packages/runtime
  -> packages/events
  -> packages/git
  -> packages/api
  -> packages/supervisor
  -> packages/integrations
  -> packages/review
```

Future apps:

```text
apps/desktop
  -> packages/domain
  -> packages/ui
  -> packages/client
  -> packages/domains
  -> launcher code for local-daemon only

apps/mobile
  -> packages/domain
  -> packages/ui
  -> packages/client
  -> packages/domains
```

## Package Rules

`packages/domain`:

- may depend on small shared runtime libraries such as `zod`;
- must not import React, DOM-specific UI code, Node-only daemon code,
  Drizzle, `better-sqlite3`, git/process APIs, or HTTP server code;
- owns pure TypeScript business types, state machines, event envelope, and zod
  contracts in OTO-5.

Frontend packages (`ui`, `client`, `domains`):

- may import `packages/domain`;
- must not import `db`, `runtime`, `events`, `git`, `api`, `supervisor`,
  `integrations`, or `review`;
- must not call Linear/GitHub directly. External API mirroring belongs to the
  local daemon.

Backend packages (`db`, `runtime`, `events`, `git`, `api`, `supervisor`,
`integrations`, `review`):

- may import `packages/domain`;
- must not import `ui`, `client`, or `domains`;
- should avoid depending on each other by default. The local daemon composes
  backend packages. A later ticket may add an explicit exception when a concrete
  package has real code and a justified dependency.

`packages/db`:

- owns Drizzle schema, migrations, repository helpers, and the isolated
  `better-sqlite3` driver;
- must not import frontend packages;
- must not contain runtime adapter, git, supervisor, or UI logic.

`packages/tooling`:

- may be referenced by workspace config;
- must not own product behavior.

## Forbidden Examples

These must fail the boundary lint:

```text
apps/web -> packages/db
apps/web -> packages/runtime
apps/web -> packages/git
apps/web -> packages/supervisor
packages/ui -> packages/db
packages/domains -> packages/integrations
packages/db -> packages/ui
packages/runtime -> packages/domains
packages/domain -> packages/db
packages/domain -> React
```

## OTO-5 Enforcement Requirement

OTO-5 must add a boundary lint step to the build so a frontend import of a
backend package fails. It should enforce the packages that exist in OTO-5 and
document the future package groups in config comments or docs without creating
placeholder packages.

Acceptable tools:

- `dependency-cruiser`
- `eslint-plugin-boundaries`

The exact tool is a local implementation choice, but `pnpm build` must run the
boundary check.
