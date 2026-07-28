// Human-readable prerelease notes rendered from the artifact manifest.
const USER_DATA_DIR = "~/Library/Application Support/Otomat";

function renderChanges(changes) {
  if (changes.length === 0) return ["### Changes", "", "First packaged alpha build."];
  return ["### Changes", "", ...changes.map((subject) => `- ${subject}`)];
}

function renderArtifacts(artifacts) {
  return artifacts.flatMap((artifact) => [
    `- \`${artifact.name}\``,
    `  - sha256 \`${artifact.sha256}\``,
  ]);
}

/**
 * @param {{ manifest: object, changes: string[] }} input — a manifest of the notarized release
 */
export function renderReleaseNotes(input) {
  const { build, artifacts } = input.manifest;
  return [
    `## Otomat ${build.version} — macOS alpha (${build.arch})`,
    "",
    "Signed with a Developer ID certificate and notarized by Apple.",
    "",
    `- commit \`${build.commit}\``,
    `- committed ${build.committed_at}`,
    `- Electron ${build.electron}`,
    "",
    "### Install",
    "",
    "1. Download the DMG below and open it.",
    "2. Drag **Otomat** into **Applications**.",
    "3. Launch it from Applications. No Gatekeeper bypass is required.",
    "",
    "### Verify what you downloaded",
    "",
    "```sh",
    `shasum -a 256 ${artifacts[0].name}`,
    "spctl --assess --type execute -vv /Applications/Otomat.app",
    "```",
    "",
    "`spctl` must answer `accepted` with `source=Notarized Developer ID`.",
    "",
    "### Uninstall and rollback",
    "",
    `Otomat installs nothing outside \`${USER_DATA_DIR}\` — no global daemon, no launch agent. It`,
    "does leave the branches and `git worktree` registrations it created inside the repositories you",
    "added; run `git worktree prune` there.",
    "",
    "- Uninstall the app: move `Otomat.app` to the Trash.",
    `- Remove its data too: delete \`${USER_DATA_DIR}\`.`,
    "- Roll back: install the previous DMG over the current one. Your data directory is left in place",
    "  and Otomat refuses to start on a data layout it does not recognise, instead of migrating down.",
    "",
    ...renderChanges(input.changes),
    "",
    "### Artifacts",
    "",
    ...renderArtifacts(artifacts),
    "",
  ].join("\n");
}
