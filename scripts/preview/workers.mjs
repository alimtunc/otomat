// The one place a preview worker's name is derived: the provisioner deploys with it, teardown
// and orphan listing parse it back, and the Pages façade reaches the same name through the
// operator-set hostname pattern documented in docs/release/web-preview.md.

const PREVIEW_WORKER_PREFIX = "otomat-preview-pr-";

export function previewWorkerName(pullRequest) {
  return `${PREVIEW_WORKER_PREFIX}${String(pullRequest)}`;
}

/** Null for any script that is not a preview worker, so a listing can never tear down the wrong one. */
export function previewWorkerPullRequest(name) {
  if (!name.startsWith(PREVIEW_WORKER_PREFIX)) return null;
  const suffix = name.slice(PREVIEW_WORKER_PREFIX.length);
  return /^[1-9][0-9]*$/.test(suffix) ? Number.parseInt(suffix, 10) : null;
}

/**
 * The deployed config must carry the worker's own name: `wrangler deploy --name` renames the
 * script but the container application keeps the config's name, so every pull request would
 * collide on one application (`otomat-preview-previewdaemon`) with the first one's DO namespace.
 */
export function renderWorkerConfig(template, name) {
  const rendered = template.replace(/"name":\s*"otomat-preview"/, `"name": "${name}"`);
  if (rendered === template) {
    throw new Error('the wrangler config template carries no "name": "otomat-preview" to render');
  }
  return rendered;
}
