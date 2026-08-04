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

## Architecture policy

The alpha ships **Apple Silicon (`arm64`) only**, one artifact per architecture, each built on a
host of that architecture. Packaging keeps the build host's `better-sqlite3` binary and the
pipeline never cross-compiles, so a release is only valid from a runner matching its
target. Adding Intel or a universal binary means adding a runner of that architecture and extending
`SUPPORTED_RELEASE_ARCHS` in `apps/desktop/scripts/release/metadata.mjs` — not a build flag.

## PR preview builds

Every pull request to `main` packages this same unsigned artifact once its `pnpm check` gate is
green: CI runs `pnpm desktop:package` on an Apple Silicon runner, exercises the result with
`pnpm desktop:smoke`, and only then uploads the DMG as a workflow artifact named
`otomat-pr-<number>-macos-arm64-<short-sha>`, kept for 7 days. The embedded `build-info.json`
names the PR's head commit, not the merge commit CI tests elsewhere. No Apple secret is read or
required: the preview is ad-hoc signed and not notarized, and the signed workflow in
`.github/workflows/release-macos.yml` remains the only distribution path.

To test a preview on an Apple Silicon Mac — no checkout, Node or pnpm required:

1. On the PR's CI run (*Checks → CI → Summary*), download the `otomat-pr-…` artifact; the run
   summary links it directly.
2. Unzip the download, open the DMG inside, and drag **Otomat** into **Applications**.
3. A plain launch is refused — macOS reports the app as damaged or unverifiable, because the
   preview is neither Developer ID signed nor notarized. That refusal is Gatekeeper working as
   intended; the explicit opt-in for an internal build is stripping its quarantine flag:

   ```sh
   xattr -dr com.apple.quarantine /Applications/Otomat.app
   ```

4. Launch Otomat from Finder. To confirm which build is running, export a support bundle
   (*Data Safety → Export Support Bundle…*): `versions.commit` must start with the short SHA in
   the artifact name.

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
needs it, and on every pull request, where the DMG is uploaded as a
[PR preview build](#pr-preview-builds).

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
own machine; packaging needs a macOS host and refuses any other platform. That artifact is not
distributable: on any other Mac, Gatekeeper refuses it unless the tester applies the explicit
override documented for [PR preview builds](#pr-preview-builds) — sharing a build with users means
going through the signed pipeline.
