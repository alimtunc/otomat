import { previewWorkerName, previewWorkerPullRequest } from "./workers.mjs";

export const PREVIEW_CONTAINER_CLASS = "PreviewDaemon";
const CONTAINER_SUFFIX = `-${PREVIEW_CONTAINER_CLASS.toLowerCase()}`;
// Pages answers 400 "Invalid list options provided" above 25.
const PAGES_DEPLOYMENTS_PAGE_SIZE = 25;

export function previewPagesBranch(pullRequest) {
  return `pr-${String(pullRequest)}`;
}

export function previewPagesPullRequest(branch) {
  const match = /^pr-([1-9][0-9]*)$/.exec(branch);
  return match === null ? null : Number.parseInt(match[1], 10);
}

export function pagesDeploymentPage(account, project, page) {
  const base = `/accounts/${account}/pages/projects/${encodeURIComponent(project)}/deployments`;
  return {
    base,
    pathname: `${base}?page=${String(page)}&per_page=${String(PAGES_DEPLOYMENTS_PAGE_SIZE)}`,
  };
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

// A short page never proves the walk is over: only the reported total_pages — or an empty page
// when the API omits result_info — ends it.
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
