// The metadata electron-updater reads: `latest-mac.yml` beside the artifacts, and `app-update.yml`
// inside the app, both emitted by electron-builder once a publish provider is configured.

/**
 * Mirrors `OTOMAT_GITHUB_REPO` in `apps/desktop/src/shared/constants.ts`, which a plain node script
 * cannot import; the test in `tests/release/update-feed.test.mjs` keeps the two from drifting.
 */
export const UPDATE_REPO = { owner: "alimtunc", repo: "otomat" };

export const UPDATE_FEED_FILE = "latest-mac.yml";

/** Configuring a provider is what makes electron-builder emit the update metadata at all. */
export function githubPublishConfig() {
  return { provider: "github", owner: UPDATE_REPO.owner, repo: UPDATE_REPO.repo };
}

// The feed is machine-generated and flat, so the two fields this check needs are read directly
// rather than pulling a YAML parser into the release path.
const URL_LINE = /^\s*(?:-\s*)?url:\s*(\S+)\s*$/gm;
const VERSION_LINE = /^version:\s*(\S+)\s*$/m;

function referencedArtifacts(feedText) {
  return [...new Set([...feedText.matchAll(URL_LINE)].map((match) => match[1]))];
}

/**
 * Throws rather than publishing a feed that would send installed apps at a download that is absent.
 *
 * @param {{ feedText: string, version: string, present: Set<string>,
 *   digestOf: (name: string) => string }} input
 * @returns {string[]} the artifacts that must be published with the feed
 */
export function assertUpdateFeed(input) {
  const version = VERSION_LINE.exec(input.feedText)?.[1];
  if (version !== input.version) {
    throw new Error(
      `${UPDATE_FEED_FILE} announces version ${version ?? "nothing"}, not ${input.version}.`,
    );
  }
  const referenced = referencedArtifacts(input.feedText);
  if (referenced.length === 0) {
    throw new Error(`${UPDATE_FEED_FILE} names no artifact to download.`);
  }
  for (const name of referenced) {
    if (!input.present.has(name)) {
      throw new Error(`${UPDATE_FEED_FILE} points at ${name}, which this build did not produce.`);
    }
    if (!input.feedText.includes(input.digestOf(name))) {
      throw new Error(`${UPDATE_FEED_FILE} carries a digest that is not ${name}'s.`);
    }
  }
  return referenced;
}
