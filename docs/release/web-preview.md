# Web Previews Per Pull Request

A pull request gets a protected web URL that tests Otomat without installing anything: the cockpit
opens immediately on browser fixtures, and switches to that commit's own daemon on the VPS once its
instance is provisioned. The desktop preview contract
([macOS alpha](macos-alpha.md)) is unchanged; this is the other half of the same test surface.

The design and its rejected alternative live in
[`docs/ai/codebase-map.md`](../ai/codebase-map.md#web-previews-per-pull-request).

## What runs where

```text
browser ──https──> Cloudflare Access ──> Pages deployment (apps/web build + preview.json)
                                          ├── static assets
                                          └── /api/*  → functions/api/[[path]].ts
                                                          │ Access service token
                                                          ▼
                                              https://otomat-pr-<n>.preview.<domain>
                                                          │ cloudflared, outbound only
                                                          ▼
                                    VPS: ~/.otomat/instances/<sha7>, daemon on 127.0.0.1:<derived>
```

No daemon port is ever reachable from the internet: cloudflared dials out, and the only way in is
the Access-protected hostname. The daemon runs with no `OTOMAT_ALLOWED_ORIGINS`, so its loopback
`Host` guard and CORS behaviour are exactly what a desktop install gets.

## One-time setup

Everything below is done once, by an operator. `.github/workflows/web-preview.yml` skips — never
fails — while any of it is missing, so a fork or an unconfigured checkout still builds green.

1. **Cloudflare Pages project** for the cockpit build. Add an Access application covering its
   preview deployments (`*.<project>.pages.dev`) with the policy your team should have.
2. **Named Cloudflare Tunnel on the VPS**, run as the user that owns `~/.otomat`. Its config must
   carry the operator's own header and then the marker the provisioner regenerates below:

   ```yaml
   tunnel: otomat-preview
   credentials-file: /home/otomat/.cloudflared/otomat-preview.json
   # --- otomat preview ingress (generated) ---
   ```

   Everything above the marker is yours and is preserved; everything below is re-derived from the
   instances present on disk. A config without the marker fails the provisioning step closed rather
   than being rewritten.
3. **Wildcard DNS + Access** for `*.preview.<domain>` pointing at that tunnel, with a policy that
   allows the Access **service token** the Pages Function uses. Per-pull-request DNS is then never
   created or deleted, which is why teardown cannot leave a dangling record.
4. **Pages environment variables** on the project's preview environment:
   `OTOMAT_PREVIEW_DAEMON_HOSTNAME` = `otomat-pr-{pr}.preview.<domain>`,
   `OTOMAT_PREVIEW_ACCESS_CLIENT_ID` and `OTOMAT_PREVIEW_ACCESS_CLIENT_SECRET` = the service token.
5. **VPS requirements**: Linux with `bash`, `git`, `flock`, `tar` and Node.js >= 22 on the login
   PATH — the same host conventions as [the remote execution host](../ai/remote-execution-host.md).

## Repository configuration

| Kind | Name | Value |
| --- | --- | --- |
| Variable | `CLOUDFLARE_PAGES_PROJECT` | Pages project name |
| Variable | `PREVIEW_VPS_HOST` | `user@host` the runner ssh's to |
| Variable | `PREVIEW_DAEMON_HOSTNAME` | `otomat-pr-{pr}.preview.<domain>` |
| Secret | `CLOUDFLARE_API_TOKEN` | Pages deploy token |
| Secret | `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account id |
| Secret | `PREVIEW_VPS_SSH_KEY` | private key authorized on the VPS |
| Secret | `PREVIEW_VPS_KNOWN_HOSTS` | the VPS's `known_hosts` line |

`PREVIEW_DAEMON_HOSTNAME` and the Pages `OTOMAT_PREVIEW_DAEMON_HOSTNAME` are the same pattern: the
provisioner names the tunnel route with it, the façade resolves the same hostname from it.

## Operating it by hand

```bash
node scripts/preview/instance.mjs list      --host user@vps
node scripts/preview/instance.mjs teardown  --host user@vps --pr 142
node scripts/preview/instance.mjs teardown  --host user@vps --build 1a2b3c4
```

`list` names every instance still on the host with the pull request it belongs to, which is how an
orphan — a deployment whose pull request closed while the workflow was down — is found. Tearing it
down is idempotent: the daemon is stopped by verified pid, the instance directory is removed, and
the ingress is re-derived without it.

## Limits worth knowing

- The **atomic deployment URL** (`<hash>.<project>.pages.dev`) works for the sandbox; the pull
  request comment links the branch alias, which is the one the tunnel is keyed to.
- Preview instances share the VPS with the stable daemon and the desktop previews. They are
  disjoint by construction (directory, database, port, worktrees), but they are not free: a busy
  repository wants the instance list checked now and then.
- A run started in a preview keeps running on the VPS after the tab is closed, exactly as it does
  from the desktop client.
