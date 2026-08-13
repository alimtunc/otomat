# macOS alpha release

Otomat has two macOS builds and they are not interchangeable.

| | `pnpm desktop:package` | `pnpm desktop:release` |
| --- | --- | --- |
| Signature | ad-hoc (`codesign --sign -`) | Developer ID Application |
| Notarized | no | yes, app and DMG, both stapled |
| Apple credentials | none | all of them, or it refuses to build |
| Runs on another Mac | only with the explicit Gatekeeper override below | yes, with no Gatekeeper bypass |
| Purpose | local development | distribution |

The unsigned build never reads a credential, and the signed build never falls back to an unsigned
artifact: `pnpm desktop:release` exits before building when any Apple input is missing, naming the
secret to configure.

## Distribution channels

Every packaged build declares a channel in its `build-info.json`, and the channel — never the
signature — decides the name it installs under, the data it opens, and the daemon it drives on a
remote host. Signing stays a separate trust property: a build claiming `stable` without a Developer
ID signature is invalid metadata and is refused, not downgraded to something else.

| Channel | Built by | Bundle | Data root under `~/Library/Application Support` | Daemon on a remote host |
| --- | --- | --- | --- | --- |
| `dev` | `pnpm desktop:dev` | — | `Otomat Dev/<worktree>` | `~/.otomat` |
| `preview` | CI on a pull request | `Otomat PR <n>.app`, `com.otomat.desktop.pr<n>` | `Otomat Preview PR <n>` | `~/.otomat/instances/<short-sha>` |
| `local` | `pnpm desktop:package` | `Otomat.app`, `com.otomat.desktop` | `Otomat Local` | `~/.otomat/local` |
| `stable` | `pnpm desktop:release` | `Otomat.app`, `com.otomat.desktop` | `Otomat` | `~/.otomat` |

`pnpm desktop:package` builds `local`, or `preview` when `PR_NUMBER` names a pull request.
`OTOMAT_CHANNEL` can state either explicitly — CI does, one per event — and the build fails when it
contradicts `PR_NUMBER`, or when it asks for a `preview` without one. It can never produce `stable`:
`pnpm desktop:release` passes that channel itself, alongside the stable identity, so no environment
variable reaches a signed build. A checkout drives `~/.otomat` on a host deliberately: exercising
the real deployment is what a checkout is for, and its local data is already split per worktree.

A packaged build whose metadata is missing, unreadable, or names no channel runs as `unknown`: its
data is `Otomat Unknown` and `~/.otomat/instances/unknown`, so a broken artifact can never open the
database of a working one. Databases left under `~/.otomat/instances/<short-sha>` by builds from
before channels existed are neither migrated nor deleted — the first `local` start begins from an
empty database, and the old instances are removed from *Settings → Execution hosts*.

Two `local` packages built from two commits of `main` therefore open the same profile: the app is
replaced, its data is not. `pnpm desktop:smoke:local` checks exactly that on a Mac — it launches the
package in `apps/desktop/release`, packages the next commit, launches that one against the same
scratch `appData`, and fails unless both opened the same root and the same database file. CI runs it
on every push to `main`.

## Architecture policy

The alpha ships **Apple Silicon (`arm64`) only**, one artifact per architecture, each built on a
host of that architecture. Packaging keeps the build host's `better-sqlite3` binary and the
pipeline never cross-compiles, so a release is only valid from a runner matching its
target. Adding Intel or a universal binary means adding a runner of that architecture and extending
`SUPPORTED_RELEASE_ARCHS` in `apps/desktop/scripts/release/metadata.mjs` — not a build flag.

## PR preview builds

CI does not build previews: a pull request runs `pnpm check` and nothing else, and packaging runs
only on a push to `main`. A preview is produced on demand, on an Apple Silicon Mac, by
`PR_NUMBER=<number> OTOMAT_CHANNEL=preview pnpm desktop:package` — the same command CI used to run —
and exercised with the same environment through `pnpm desktop:smoke`. A preview instance on a remote
execution host consequently has no CI bundle to deploy for its own commit; deploy from a checkout of
that commit instead.

`PR_NUMBER` names the
build after its pull request — **Otomat PR 77.app**, bundle id `com.otomat.desktop.pr77`, data in
`Otomat Preview PR 77` — so two previews under test and the stable install coexist on one Mac
sharing no app, no single-instance lock and no data. A malformed `PR_NUMBER` fails the build
rather than quietly packaging the stable identity, and `pnpm desktop:release` passes the stable
identity explicitly, so no environment variable can rename a signed build. No Apple secret is read
or required: the preview is ad-hoc signed and not notarized, and the signed workflow in
`.github/workflows/release-macos.yml` remains the only distribution path.

To test a preview on an Apple Silicon Mac:

1. Take the DMG the packaging run left in `apps/desktop/release`.
2. Open it and drag **Otomat PR &lt;number&gt;** into **Applications**.
3. A plain launch is refused — macOS reports the app as damaged or unverifiable, because the
   preview is neither Developer ID signed nor notarized. That refusal is Gatekeeper working as
   intended; the explicit opt-in for an internal build is stripping its quarantine flag:

   ```sh
   xattr -dr com.apple.quarantine "/Applications/Otomat PR 77.app"
   ```

4. Launch it from Finder. To confirm which build is running, export a support bundle
   (*Data Safety → Export Support Bundle…*): `versions.commit` must start with the packaged
   commit's short SHA, and `versions.channel` must read `preview` — each bundle names its own
   commit and the channel whose data it opened.

A preview keeps its data in `~/Library/Application Support/Otomat Preview PR <number>`, beside —
never inside — the stable install's data or an ad-hoc `local` package's
([distribution channels](#distribution-channels)). Several previews and the stable app therefore
run side by side, and deleting that one folder removes every trace of testing that PR. On first
launch it seeds a sandbox: a
disposable fixture repository (`test-repo` inside that data folder) registered with a handful of
ready-made issues, so there is something to launch runs against immediately. *Settings → Sandbox →
Reset test data* wipes the database, runs, worktrees and the fixture repository, then reseeds —
every test session can start from the same known state. Pointed at a remote execution host, a
preview targets its own isolated daemon under `~/.otomat/instances/<short-sha>` there —
provisioned on demand from a deploy of that commit, given the same fixture repository and
issues inside that directory on connect, and controlled (stop, delete, deploy) from *Settings →
Execution hosts*, where **Delete** removes daemon, data, worktrees and fixture in one action — so
testing an artifact never disturbs the stable daemon
([test instances](../ai/remote-execution-host.md#test-instances)).

A preview is for the team's own test hardware only. Handing someone a DMG plus quarantine-stripping
instructions is exactly the pattern the signed pipeline exists to replace — share builds through a
release, never through a preview artifact.

## One-time Apple setup

You need a paid Apple Developer Program membership. None of the material below is ever committed,
printed or uploaded; it exists only as repository secrets and as a file the runner shreds.

1. **Developer ID Application certificate.** In Xcode (*Settings → Accounts → Manage Certificates*)
   or on the Apple Developer portal, create a *Developer ID Application* certificate. Export it from
   Keychain Access as a `.p12` with a password. Base64 it: `base64 -i certificate.p12 | pbcopy`.
2. **App Store Connect API key.** In App Store Connect (*Users and Access → Integrations → App Store
   Connect API*), create a team key with the **Developer** role. Download the `.p8` once — Apple will
   not offer it again — and note its Key ID and the Issuer ID. Base64 it:
   `base64 -i AuthKey_XXXX.p8 | pbcopy`.
3. **Team ID.** The 10-character identifier on your Apple Developer membership page.

## Repository secrets

Set these under *Settings → Secrets and variables → Actions*. Names and types only; the workflow
never echoes a value.

| Secret | Type |
| --- | --- |
| `MACOS_CERTIFICATE_P12_BASE64` | base64 of the Developer ID Application `.p12` |
| `MACOS_CERTIFICATE_PASSWORD` | the password that `.p12` was exported with |
| `APPLE_TEAM_ID` | 10-character Apple Developer Team ID |
| `APPLE_API_KEY_P8_BASE64` | base64 of the App Store Connect `.p8` key |
| `APPLE_API_KEY_ID` | Key ID of that key |
| `APPLE_API_ISSUER` | Issuer ID of that key |

The workflow decodes the `.p8` into the runner's temp directory, exports its path as `APPLE_API_KEY`
for `notarytool`, and removes it in an `always()` step. electron-builder imports the certificate
into a throwaway keychain from `CSC_LINK` / `CSC_KEY_PASSWORD`.

## Cutting a release

1. Bump `version` in `apps/desktop/package.json`.
2. Merge that to `main`.
3. Tag it: `git tag v<version> && git push origin v<version>`. The tag and the packaged version must
   agree — the pipeline refuses the build otherwise.

`.github/workflows/release-macos.yml` runs `pnpm check` first, while no Apple credential exists on
the runner yet. It then decodes the App Store Connect key and runs `pnpm desktop:preflight` — every
credential present, an architecture this runner can build, a tag that agrees with the version —
before anything expensive. It then builds, signs with the hardened runtime and the entitlements in
`apps/desktop/build/entitlements.mac.plist`, notarizes and staples the app and the DMG, and only
then verifies that:

- the app's signature is internally consistent (`codesign --verify --deep --strict`);
- it is signed by a *Developer ID Application* certificate belonging to `APPLE_TEAM_ID`, with the
  hardened runtime enabled;
- Gatekeeper accepts it as `source=Notarized Developer ID` (`spctl --assess`);
- both the app and the DMG carry a stapled ticket (`stapler validate`).

Any failed check fails the job before anything is published. `pnpm desktop:smoke` then installs the
DMG and exercises the artifact, and only after that is the prerelease created from
`release-notes.md` with the DMG and `manifest.json` attached. `manifest.json` ties the download to a
commit, a version, an architecture, an Electron version and a sha256.

Running the workflow manually (*Run workflow*) does everything **except** publishing, which is how
you exercise the pipeline without creating a release. `ci.yml` also packages and smokes the
*unsigned* artifact on every push to `main`, so a packaging regression surfaces before a release
needs it.

## Verifying on a clean Mac

Automated coverage stops at the artifact: `pnpm desktop:smoke` mounts the DMG, copies the app out
with `ditto`, checks the bundle identity, the shipped SQLite binding's architecture and that the
installed copy still passes `codesign --verify --deep --strict`, boots the installed daemon through
the app's own Electron binary until `/api/health` answers, stops it, then launches the whole app and
quits it, failing if a daemon process survives. What it cannot cover is a machine that has never
seen this developer account, so do this once per release on a clean Mac (or a fresh macOS VM / a
second user account):

1. Download the DMG from the prerelease. Confirm its sha256 against `manifest.json`.
2. Open it and drag **Otomat** into **Applications**. Launch it from Finder — a double-click, not a
   right-click → *Open*. It must start with no Gatekeeper prompt and no quarantine warning.
3. `spctl --assess --type execute -vv /Applications/Otomat.app` → `accepted`,
   `source=Notarized Developer ID`.
4. In the app: add a local repository through the folder picker, confirm the agent CLIs are
   discovered (the app resolves your login shell `PATH`, so `claude` / `codex` are found from a
   Finder launch), and complete one real run.
5. Quit with ⌘Q. `pgrep -f otomat` must print nothing: the app owns the daemon's lifetime.
6. Export a support bundle (*Data Safety → Export Support Bundle…*) and check that `versions.commit`
   matches the release commit. That is how an alpha bug report identifies its build.
7. Upgrade check: install the next build over this one and confirm the data survives — the database
   and every run live in `~/Library/Application Support/Otomat`, which the installer never touches.

## Uninstall and rollback

- Uninstall the app: move `Otomat.app` to the Trash.
- Remove its data: delete `~/Library/Application Support/Otomat`. Otomat installs nothing else — no
  global daemon, no launch agent, no `/usr/local` install. It does leave the branches and
  `git worktree` registrations it created *inside the repositories you added*; run
  `git worktree prune` there.
- Roll back: install the previous DMG over the current one. The data directory is left in place, and
  Otomat refuses to start on a data layout newer than it understands rather than migrating downward,
  so a rollback across a layout change means restoring a backup from
  `~/Library/Application Support/Otomat/backups`.

## Local development

`pnpm desktop:dev` runs the shell against the Vite dev server with a daemon built from source.
`pnpm desktop:package` produces the ad-hoc signed artifact for testing the packaged shape on your
own machine — the `local` channel, whose profile survives every rebuild, so installing a newer one
keeps the projects, repositories, issues, runs and reviews of the previous.
`pnpm desktop:smoke:local` proves that on a clean checkout; it commits an empty commit, packages
it, and resets the branch, so it refuses to run on a dirty working tree. Packaging needs a macOS
host and refuses any other platform. That artifact is not
distributable: on any other Mac, Gatekeeper refuses it unless the tester applies the explicit
override documented for [PR preview builds](#pr-preview-builds) — sharing a build with users means
going through the signed pipeline.
