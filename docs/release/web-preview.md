# Web Previews Per Pull Request

A pull request gets a protected web URL that tests Otomat without installing anything: the cockpit
opens immediately on browser fixtures, and switches to that commit's own daemon — running in a
Cloudflare container, not on anyone's VPS — once it is provisioned. The desktop preview contract
([macOS alpha](macos-alpha.md)) is unchanged; this is the other half of the same test surface.

The design and its rejected alternatives live in
[`docs/ai/codebase-map.md`](../ai/codebase-map.md#web-previews-per-pull-request).

## What runs where

```text
browser ──https──> Cloudflare Access ──> Pages deployment (apps/web build + preview.json)
                                          ├── static assets
                                          └── /api/*  → functions/api/[[path]].ts
                                                          │ verifies the Access JWT, then adds
                                                          │ the preview client pair
                                                          ▼
                              otomat-preview-pr-<n>.<subdomain>.workers.dev
                                (Worker: refuses any request without the pair)
                                                          │ Host rewritten to loopback
                                                          ▼
                              Cloudflare container: this commit's daemon dist,
                              ephemeral SQLite + fixture repo, sleeps after 1h idle
```

No daemon port exists anywhere on the internet: the container only answers its own Worker, the
Worker only answers requests carrying the client pair, and the façade only lends that pair to a
request whose Cloudflare Access identity it has verified at the origin. The daemon runs with no
`OTOMAT_ALLOWED_ORIGINS`, so its loopback `Host` guard and CORS behaviour are exactly what a
desktop install gets.

## One-time setup

Everything below is done once, by an operator. `.github/workflows/web-preview.yml` skips — never
fails — while any of it is missing, so a fork or an unconfigured checkout still builds green.

1. **Workers Paid plan** ($5/month) on the Cloudflare account: Containers require it. Container
   time itself is billed per active second and the instances sleep when idle.
2. **Cloudflare Pages project** for the cockpit build. Enable the built-in **Access policy** on the
   project so `*.<project>.pages.dev` (production and previews) requires your team's login, and
   note the Access application's **AUD tag** and your team domain
   (`<team>.cloudflareaccess.com`).
3. **API token** used by CI, with `Cloudflare Pages: Edit`, `Workers Scripts: Edit` and
   `Containers: Edit` on the account.
4. **Preview client pair** — the machine credential between the façade and the daemon workers.
   Generate two random values, for example `openssl rand -hex 16` and `openssl rand -hex 32`.
5. **Pages environment variables** on the project's preview environment:

   | Variable | Value |
   | --- | --- |
   | `OTOMAT_PREVIEW_DAEMON_HOSTNAME` | `otomat-preview-pr-{pr}.<subdomain>.workers.dev` |
   | `OTOMAT_PREVIEW_ACCESS_TEAM_DOMAIN` | `<team>.cloudflareaccess.com` |
   | `OTOMAT_PREVIEW_ACCESS_AUD` | the Access application's AUD tag |
   | `OTOMAT_PREVIEW_CLIENT_ID` | the pair's id half |
   | `OTOMAT_PREVIEW_CLIENT_SECRET` | the pair's secret half |

   `<subdomain>` is the account's `workers.dev` subdomain. While the Access variables are unset the
   façade refuses `/api/*` entirely — a preview is never public by default — and the sandbox keeps
   working.

## Repository configuration

| Kind | Name | Value |
| --- | --- | --- |
| Variable | `CLOUDFLARE_PAGES_PROJECT` | Pages project name |
| Variable | `PREVIEW_DAEMON_ENABLED` | any non-empty value turns daemon previews on |
| Secret | `CLOUDFLARE_API_TOKEN` | the API token above |
| Secret | `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account id |
| Secret | `PREVIEW_CLIENT_ID` | the same pair as the Pages variables |
| Secret | `PREVIEW_CLIENT_SECRET` | the same pair as the Pages variables |

The Worker checks the pair itself, under the Access service-token header names — fronting the
workers with a real Access policy on a custom domain later needs no code change.

## Operating it by hand

```bash
export CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=…
node scripts/preview/instance.mjs list
node scripts/preview/instance.mjs teardown --pr 142
```

`list` names every preview worker still deployed with the pull request it belongs to, which is how
an orphan — a deployment whose pull request closed while the workflow was down — is found. Tearing
one down deletes the worker — which takes its container, route and data with it — and, when
`CLOUDFLARE_PAGES_PROJECT` is set in the environment, purges the pull request's Pages deployments
too; both halves are idempotent. It then tries to delete the worker's registry image best-effort —
the beta `wrangler containers images` command is allowed to refuse without failing the teardown, so
`pnpm dlx wrangler@4 containers images list` / `… delete` is still how leftovers are reclaimed.

## Limits worth knowing

- The **atomic deployment URL** (`<hash>.<project>.pages.dev`) works for the sandbox; the pull
  request comment links the branch alias, which is the one the manifest keys the daemon worker to.
- The container's disk is **ephemeral**: after an hour idle it sleeps, and the next request boots
  it fresh — reseeded fixture repository, empty database, a few seconds of cold start behind the
  "starting" status. That reset is a feature for previews and a difference from the desktop
  preview instances on the VPS.
- A run keeps executing while the container is awake even if the tab closes, but an idle-timeout
  sleep ends it; previews are for exercising workflows, not for long unattended runs.
- Agent providers are not installed in the container, so launching a real agent run fails at the
  provider; navigation, issues, views, diff, SSE and lifecycle flows are what the full preview
  exercises.
