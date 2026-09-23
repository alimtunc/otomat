# Contributing

Otomat is developed in the open at
[github.com/alimtunc/otomat](https://github.com/alimtunc/otomat). Bug reports, questions and
pull requests are welcome; the project is in alpha, so expect the surface to move.

## Run it from source

You need Node.js 22+, pnpm 12 (`corepack enable pnpm`) and, to run agents, the same
[prerequisites](./prerequisites.md) as the app.

```sh
git clone https://github.com/alimtunc/otomat.git
cd otomat
pnpm install        # workspace + git hooks
pnpm build          # every package, then the import-boundary check
pnpm desktop:dev    # Electron shell + Vite dev server + a daemon built from source
```

`pnpm dev` and `pnpm back` in two terminals run the cockpit in a browser against a standalone
daemon instead. That daemon answers only callers presenting the token it writes to
`apps/local-daemon/.data/daemon-token`; the Vite proxy presents it for the cockpit.

`pnpm check` is the gate every pull request must pass;
[`AGENTS.md`](https://github.com/alimtunc/otomat/blob/main/AGENTS.md) defines it, the commit
convention and the code rules.

## Where things are

The documents below are the canonical references; nothing on this site repeats them.

- [`AGENTS.md`](https://github.com/alimtunc/otomat/blob/main/AGENTS.md) — the contributor and
  agent guide: layout, import boundaries, code quality rules, conventions, commands.
- [Codebase map](https://github.com/alimtunc/otomat/blob/main/docs/ai/codebase-map.md) — which
  module owns which behaviour, and the reasoning behind each design; the
  [architecture atlas](https://github.com/alimtunc/otomat/blob/main/docs/ai/otomat-visual-map.html)
  is its standalone visual companion (download and open locally).
- [Import boundaries](https://github.com/alimtunc/otomat/blob/main/docs/ai/import-boundaries.md),
  [Run lifecycle](https://github.com/alimtunc/otomat/blob/main/docs/ai/run-lifecycle.md),
  [Codex permissions](https://github.com/alimtunc/otomat/blob/main/docs/ai/codex-permissions.md),
  [Remote execution host](https://github.com/alimtunc/otomat/blob/main/docs/ai/remote-execution-host.md),
  [GitHub pull-request sync](https://github.com/alimtunc/otomat/blob/main/docs/ai/github-pull-request-sync.md).
- [macOS release](https://github.com/alimtunc/otomat/blob/main/docs/release/macos-alpha.md) and
  [web previews](https://github.com/alimtunc/otomat/blob/main/docs/release/web-preview.md) — how
  the app is packaged, signed, released and previewed.

## This documentation

The site is a [VitePress](https://vitepress.dev) project in `apps/docs`: plain Markdown pages
under `apps/docs/guide`, the navigation in `apps/docs/.vitepress/config.ts`. Every page has an
**Edit this page on GitHub** link.

```sh
pnpm docs:dev      # live preview at http://localhost:5173
pnpm docs:build    # static site in apps/docs/.vitepress/dist; fails on a dead internal link
```

Publication is automatic: `.github/workflows/docs.yml` builds the site, checks every internal and
external link with [lychee](https://lychee.cli.rs) (`lychee --config lychee.toml apps/docs README.md`
runs the same check locally), and deploys `main` to
[otomat-docs.pages.dev](https://otomat-docs.pages.dev) and a pull request to
`pr-<number>.otomat-docs.pages.dev`. The one-time Cloudflare setup is described in the
[web preview reference](https://github.com/alimtunc/otomat/blob/main/docs/release/web-preview.md#repository-configuration).
