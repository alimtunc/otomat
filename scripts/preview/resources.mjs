import { previewWorkerName, previewWorkerPullRequest } from "./workers.mjs";

export const PREVIEW_CONTAINER_CLASS = "PreviewDaemon";
const CONTAINER_SUFFIX = `-${PREVIEW_CONTAINER_CLASS.toLowerCase()}`;

export function previewPagesBranch(pullRequest) {
  return `pr-${String(pullRequest)}`;
}

export function previewPagesPullRequest(branch) {
  const match = /^pr-([1-9][0-9]*)$/.exec(branch);
  return match === null ? null : Number.parseInt(match[1], 10);
}

export function previewContainerName(pullRequest) {
  return `${previewWorkerName(pullRequest)}${CONTAINER_SUFFIX}`;
}

export function previewContainerPullRequest(name) {
  if (!name.endsWith(CONTAINER_SUFFIX)) return null;
  return previewWorkerPullRequest(name.slice(0, -CONTAINER_SUFFIX.length));
}

export function ownedContainerApplications(applications, pullRequest) {
  const name = previewContainerName(pullRequest);
  return applications.filter(
    (application) => application?.name === name && typeof application.id === "string",
  );
}

export function ownedPagesDeployments(deployments, pullRequest) {
  const branch = previewPagesBranch(pullRequest);
  return deployments.filter(
    (deployment) =>
      deployment?.deployment_trigger?.metadata?.branch === branch &&
      typeof deployment.id === "string",
  );
}

export function ownedRegistryImages(repositories, pullRequest) {
  const names = new Set([previewWorkerName(pullRequest), previewContainerName(pullRequest)]);
  const images = [];
  for (const repository of repositories) {
    if (!names.has(repository?.name) || !Array.isArray(repository.tags)) continue;
    for (const tag of repository.tags) {
      if (typeof tag === "string" && tag !== "") images.push(`${repository.name}:${tag}`);
    }
  }
  return images;
}

export function previewRegistryPullRequest(name) {
  return previewWorkerPullRequest(name) ?? previewContainerPullRequest(name);
}

export function isIdempotentDeleteStatus(status) {
  return status === 200 || status === 404;
}

// The API clamps per_page (Pages caps it at 25), so a short page proves nothing; only the
// reported total_pages — or an empty page when the API omits result_info — ends the walk.
export function isFinalPage(rows, resultInfo, page) {
  const totalPages = resultInfo?.total_pages;
  if (Number.isInteger(totalPages)) return page >= totalPages;
  return rows.length === 0;
}

export async function runCleanupTasks(tasks) {
  const failures = [];
  for (const [label, task] of tasks) {
    try {
      await task();
    } catch (error) {
      const causes = error instanceof AggregateError ? error.errors : [error];
      for (const cause of causes) {
        failures.push(
          new Error(`${label}: ${cause instanceof Error ? cause.message : String(cause)}`),
        );
      }
    }
  }
  if (failures.length > 0) throw new AggregateError(failures, "preview cleanup incomplete");
}
