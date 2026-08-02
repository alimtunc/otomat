import { projectContractSchema, type ProjectContract } from "@otomat/domain";

/** One host's project catalog over plain HTTP; unreachable or invalid reads null (logged), never an error. */
export async function fetchProjectCatalog(
  baseUrl: string,
  fetchImpl: typeof fetch,
  log: (message: string) => void,
): Promise<ProjectContract[] | null> {
  try {
    const response = await fetchImpl(`${baseUrl}/api/projects`);
    if (!response.ok) return null;
    const parsed = projectContractSchema.array().safeParse(await response.json());
    if (!parsed.success) {
      log(`Host at ${baseUrl} returned an invalid project list`);
      return null;
    }
    return parsed.data;
  } catch (error) {
    log(`Could not list projects from ${baseUrl}: ${String(error)}`);
    return null;
  }
}
