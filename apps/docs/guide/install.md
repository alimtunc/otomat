# Install on macOS

Otomat ships as a signed and notarized macOS app for **Apple Silicon**. Intel Macs are not
supported by the alpha builds.

## Install

1. Open the [GitHub releases page](https://github.com/alimtunc/otomat/releases) and download the
   `.dmg` of the latest release. Alpha versions are published as **pre-releases**.
2. Optional: check the download against the `manifest.json` attached to the same release
   (`shasum -a 256 <file>.dmg` must match its `sha256`).
3. Open the DMG and drag **Otomat** into **Applications**.
4. Launch it from Finder. No Gatekeeper prompt should appear — the release build is signed with a
   Developer ID and notarized by Apple. If macOS reports the app as damaged, you downloaded an
   unsigned development artifact rather than a release; use the releases page.

On first launch Otomat creates its data directory and starts its daemon. Nothing is installed
outside the app bundle: no global daemon, no launch agent, nothing under `/usr/local`.

::: tip Command-line tools
Otomat launches `git`, `gh`, `claude` and `codex` the way your terminal would: it reads the
`PATH` of your login shell, and only `PATH`. Tools that work in a terminal work from a Finder
launch. See [Prerequisites](./prerequisites.md).
:::

## Update

Otomat checks for a newer release at startup (at most once every four hours) and downloads it in
the background. It **never installs on its own**.

- _Settings → About · Daemon → Updates_ shows the channel, the current and available versions, the
  release notes and the download progress. The Activity Center in the header carries the same
  state while you work elsewhere.
- **Install and restart** is the only way to apply an update. It is refused — naming the host and
  the run count — while any configured execution host still has a run in flight or cannot be
  reached. Let the runs finish or stop them, then click again.
- Pre-release versions follow the pre-release feed and stable versions the stable feed. Otomat
  never downgrades and never jumps feeds; it still reports up to date and names the release that
  exists on the other feed.

Self-update only works for the signed release build installed in `/Applications`. Any other build
offers the releases page instead.

Your data survives an update: the installer never touches the
[data directory](./data-and-security.md#what-is-stored-and-where).

## Uninstall and roll back

- **Uninstall:** move `Otomat.app` to the Trash.
- **Remove the data:** delete the [data directory](./data-and-security.md#what-is-stored-and-where).
  Otomat leaves the branches and `git worktree` registrations it created _inside the repositories
  you added_; run `git worktree prune` there if you want them gone.
- **Roll back:** install the previous DMG over the current one. Across a schema change, restore
  the matching [backup](./data-and-security.md#backups) first.
