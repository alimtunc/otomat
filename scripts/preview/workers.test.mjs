import assert from "node:assert/strict";
import { test } from "node:test";

import { previewWorkerName, previewWorkerPullRequest } from "./workers.mjs";

test("names a pull request's worker and parses it back", () => {
  assert.equal(previewWorkerName(142), "otomat-preview-pr-142");
  assert.equal(previewWorkerPullRequest("otomat-preview-pr-142"), 142);
});

test("refuses every script that is not a preview worker", () => {
  assert.equal(previewWorkerPullRequest("otomat-daemon"), null);
  assert.equal(previewWorkerPullRequest("otomat-preview-pr-"), null);
  assert.equal(previewWorkerPullRequest("otomat-preview-pr-0"), null);
  assert.equal(previewWorkerPullRequest("otomat-preview-pr-abc"), null);
  assert.equal(previewWorkerPullRequest("otomat-preview-pr-142-old"), null);
});
