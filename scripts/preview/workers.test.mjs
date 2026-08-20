import assert from "node:assert/strict";
import { test } from "node:test";

import { previewWorkerName, previewWorkerPullRequest, renderWorkerConfig } from "./workers.mjs";

test("names a pull request's worker and parses it back", () => {
  assert.equal(previewWorkerName(142), "otomat-preview-pr-142");
  assert.equal(previewWorkerPullRequest("otomat-preview-pr-142"), 142);
});

test("renders the worker's own name into the config template", () => {
  const template = '{\n  "name": "otomat-preview",\n  "workers_dev": true\n}\n';
  assert.equal(
    renderWorkerConfig(template, "otomat-preview-pr-142"),
    '{\n  "name": "otomat-preview-pr-142",\n  "workers_dev": true\n}\n',
  );
});

test("refuses a config template that names no otomat-preview worker", () => {
  assert.throws(() => renderWorkerConfig('{"name": "something-else"}', "otomat-preview-pr-142"));
});

test("refuses every script that is not a preview worker", () => {
  assert.equal(previewWorkerPullRequest("otomat-daemon"), null);
  assert.equal(previewWorkerPullRequest("otomat-preview-pr-"), null);
  assert.equal(previewWorkerPullRequest("otomat-preview-pr-0"), null);
  assert.equal(previewWorkerPullRequest("otomat-preview-pr-abc"), null);
  assert.equal(previewWorkerPullRequest("otomat-preview-pr-142-old"), null);
});
