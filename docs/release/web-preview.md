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

## Resource ownership

| Resource | Ownership and cleanup |
| --- | --- |
| Pages deployment on branch `pr-<n>` | dedicated; exact-branch deployments are deleted |
| Worker `otomat-preview-pr-<n>` and its `workers.dev` route | dedicated; deleting the exact script removes both and its Worker secret |
| Container application `otomat-preview-pr-<n>-previewdaemon` | dedicated; deleted by its exact name |
| Container image tags | dedicated repositories derived from the exact Worker/application names; deleted on close |
| Durable Object instance, SQLite and fixture repo | dedicated to the container application and ephemeral; removed with the application |
| Pages project, Access policy/environment and preview client pair | shared; inventoried by configuration, never deleted |
| `preview-base:node22` image | shared by all previews; updated in place, never handled by PR cleanup |
| Tunnel, route outside `workers.dev`, or preview VPS daemon | not created by this architecture |

The PR comment is historical review metadata rather than a provisioned runtime resource and remains
on the closed PR.

## One-time setup

Everything below is done once, by an operator. Deploy surfaces stay disabled while their repository
variable is absent. Cleanup skips an account with no Cloudflare credentials and fails visibly for
partial credentials, so an unconfigured fork stays green without masking a broken configured repo.

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

6. **Preview base image** — dispatch `Preview base image` once. It publishes the Linux/amd64
   Node + git layer at `ghcr.io/<owner>/<repo>/preview-base:node22`; subsequent provisions rebuild
   only the commit-specific daemon layers. A push to `main` republishes it when
   `scripts/preview/host/base.Dockerfile` changes.

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
export CLOUDFLARE_PAGES_PROJECT=…
node scripts/preview/instance.mjs inventory
node scripts/preview/instance.mjs teardown --pr 142
```

`inventory`, `warm` and `teardown` run without an installed workspace — only `provision` needs
`@otomat/domain` built. The workflow's `workflow_dispatch` offers the same `inventory` and
`teardown` operations. Inventory
groups strict preview Worker, container application, Pages deployment and registry-image names by
pull request and labels the pull request `open`, `closed`, `merged` or `missing` — `unknown` when
`GITHUB_REPOSITORY`/`GITHUB_TOKEN` are absent, as in the snippet above. A closed, merged or
missing row is an orphan candidate; deletion always remains an explicit `--pr` operation.

Teardown derives every target from that validated number: Worker `otomat-preview-pr-142`, container
application `otomat-preview-pr-142-previewdaemon`, Pages branch `pr-142`, and only the matching
image repositories. It never deletes the shared Pages project, Access application, repository
secrets or another PR's resources. Worker/container/Pages/image cleanup attempts all resource
classes, treats an already-absent target as success, and fails visibly when any real deletion fails.
The closed-event workflow happens after merge eligibility is decided, so a red cleanup is visible
without falsifying or blocking the merge; dispatch can replay it until clean.

Provisions before the per-pull-request config rendering shared one container application named
`otomat-preview-previewdaemon`, which made any second pull request's deploy fail on its durable
object namespace. If that stale application still exists on the account, delete it once:

```bash
pnpm dlx wrangler@4 containers list
pnpm dlx wrangler@4 containers delete <application-id>
```

Successive commits cancel their superseded deploy. A close does not cancel the deploy already in
flight: it queues, then removes the final exact names. Reopening provisions the same names again,
and a repeated cleanup remains safe. Preview images and Pages deployments have no retention window:
they are deleted immediately on close.

## Limits worth knowing

- The **atomic deployment URL** (`<hash>.<project>.pages.dev`) works for the sandbox; the pull
  request comment links the branch alias, and the deployment is stamped with the full PR head SHA.
- The container's disk is **ephemeral**: after an hour idle it sleeps, and the next request boots
  it fresh — reseeded fixture repository, empty database, a few seconds of cold start behind the
  "starting" status. That reset is a feature for previews and a difference from the desktop
  preview instances on the VPS.
- A run keeps executing while the container is awake even if the tab closes, but an idle-timeout
  sleep ends it; previews are for exercising workflows, not for long unattended runs.
- Agent providers are not installed in the container, so launching a real agent run fails at the
  provider; navigation, issues, views, diff, SSE and lifecycle flows are what the full preview
  exercises.
