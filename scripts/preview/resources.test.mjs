import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  isFinalPage,
  isIdempotentDeleteStatus,
  ownedContainerApplications,
  ownedPagesDeployments,
  ownedRegistryImages,
  pagesDeploymentPage,
  PREVIEW_CONTAINER_CLASS,
  previewContainerName,
  previewContainerPullRequest,
  previewPagesBranch,
  previewPagesPullRequest,
  previewRegistryPullRequest,
  runCleanupTasks,
} from "./resources.mjs";

test("keeps cleanup identity aligned with the container class", () => {
  const config = readFileSync(new URL("./host/wrangler.jsonc", import.meta.url), "utf8");
  assert.match(config, new RegExp(`"class_name":\\s*"${PREVIEW_CONTAINER_CLASS}"`));
  assert.equal(previewContainerName(142), "otomat-preview-pr-142-previewdaemon");
});

test("round-trips only exact preview resource names", () => {
  assert.equal(previewPagesBranch(142), "pr-142");
  assert.equal(previewPagesPullRequest("pr-142"), 142);
  assert.equal(previewPagesPullRequest("pr-142-old"), null);
  assert.equal(previewContainerPullRequest("otomat-preview-pr-142-previewdaemon"), 142);
  assert.equal(previewContainerPullRequest("otomat-preview-pr-142-other"), null);
  assert.equal(previewRegistryPullRequest("otomat-preview-pr-142"), 142);
  assert.equal(previewRegistryPullRequest("otomat-preview-pr-142-previewdaemon"), 142);
  assert.equal(previewRegistryPullRequest("otomat-preview-pr-142-old"), null);
});

test("selects only resources proven to belong to one pull request", () => {
  const applications = [
    { id: "a", name: "otomat-preview-pr-141-previewdaemon" },
    { id: "b", name: "otomat-preview-pr-142-previewdaemon" },
    { id: "c", name: "otomat-preview-pr-142-other" },
    { id: "shared", name: "otomat-preview" },
  ];
  const deployments = [
    { id: "d141", deployment_trigger: { metadata: { branch: "pr-141" } } },
    { id: "d142", deployment_trigger: { metadata: { branch: "pr-142" } } },
    { id: "old", deployment_trigger: { metadata: { branch: "pr-142-old" } } },
    { id: "main", deployment_trigger: { metadata: { branch: "main" } } },
  ];
  const repositories = [
    { name: "otomat-preview-pr-141", tags: ["one"] },
    { name: "otomat-preview-pr-142", tags: ["one"] },
    { name: "otomat-preview-pr-142-previewdaemon", tags: ["two"] },
    { name: "otomat-preview-pr-142-old", tags: ["three"] },
  ];

  assert.deepEqual(ownedContainerApplications(applications, 142), [applications[1]]);
  assert.deepEqual(ownedPagesDeployments(deployments, 142), [deployments[1]]);
  assert.deepEqual(ownedRegistryImages(repositories, 142), [
    "otomat-preview-pr-142:one",
    "otomat-preview-pr-142-previewdaemon:two",
  ]);
});

test("ends the deployment walk on total_pages, never on a short page", () => {
  const shortPage = Array.from({ length: 25 }, (_, index) => ({ id: String(index) }));
  assert.equal(isFinalPage(shortPage, { total_pages: 3 }, 1), false);
  assert.equal(isFinalPage(shortPage, { total_pages: 3 }, 3), true);
  assert.equal(isFinalPage(shortPage, { total_pages: 1 }, 1), true);
  assert.equal(isFinalPage([], { total_pages: 0 }, 1), true);
  assert.equal(isFinalPage(shortPage, undefined, 1), false);
  assert.equal(isFinalPage([], undefined, 2), true);
});

test("requests a Pages deployment page within the endpoint limit", () => {
  assert.deepEqual(pagesDeploymentPage("account", "otomat/web", 2), {
    base: "/accounts/account/pages/projects/otomat%2Fweb/deployments",
    pathname: "/accounts/account/pages/projects/otomat%2Fweb/deployments?page=2&per_page=25",
  });
});

test("treats not-found deletes as idempotent success", () => {
  assert.equal(isIdempotentDeleteStatus(200), true);
  assert.equal(isIdempotentDeleteStatus(404), true);
  assert.equal(isIdempotentDeleteStatus(403), false);
  assert.equal(isIdempotentDeleteStatus(500), false);
});

test("attempts every cleanup task before reporting failures", async () => {
  const attempted = [];
  await assert.rejects(
    runCleanupTasks([
      ["worker", () => attempted.push("worker")],
      [
        "container",
        () => {
          attempted.push("container");
          throw new Error("unavailable");
        },
      ],
      ["pages", () => attempted.push("pages")],
    ]),
    { name: "AggregateError", message: "preview cleanup incomplete" },
  );
  assert.deepEqual(attempted, ["worker", "container", "pages"]);
});

test("can replay an already-clean cleanup", async () => {
  let attempts = 0;
  const tasks = [["worker", () => (attempts += 1)]];
  await runCleanupTasks(tasks);
  await runCleanupTasks(tasks);
  assert.equal(attempts, 2);
});
