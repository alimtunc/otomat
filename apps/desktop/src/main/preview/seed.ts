import { realpathSync } from "node:fs";

import type { DaemonEndpoint } from "@otomat/client";
import { daemonAuthorization } from "@otomat/domain";

const FIXTURE_ISSUES: ReadonlyArray<{ title: string; body: string }> = [
  {
    title: "greet() mangles empty names",
    body: 'Running `node src/cli.js ""` prints `Hello, !`. An empty or blank name should fall back to `world`, matching the CLI default. Add a regression test in `test/greeter.test.js`.',
  },
  {
    title: "Add a --shout flag to the CLI",
    body: "`node src/cli.js Ada --shout` should print `HELLO, ADA!`. The flag may appear in any position; an unknown flag should fail with a usage message and exit code 1.",
  },
  {
    title: "Add a farewell command",
    body: "Add `farewell(name)` to `src/greeter.js` returning `Goodbye, <name>.` and wire it as `node src/cli.js --farewell Ada`. Cover both the function and the CLI path with tests.",
  },
  {
    title: "Document the CLI in the README",
    body: "The README does not mention the CLI at all. Document both commands with examples, and note that `npm test` runs the node test suite.",
  },
];

export interface SeedSandboxOptions {
  daemon: DaemonEndpoint;
  repoPath: string;
  fetchImpl?: typeof fetch;
  /** Canonicalizer for `repoPath`; a remote sandbox path is already canonical and has no local file. */
  realpath?: (path: string) => string;
}

type DaemonRequest = (
  path: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<Response>;

export interface SeedSandboxResult {
  /** False when the repository was already registered with its issues intact; nothing was touched. */
  seeded: boolean;
  issues: number;
}

/**
 * Registers the sandbox repository with the local daemon and, on a fresh registration, files
 * the fixture issues. Everything goes through the public HTTP API: the daemon stays the only
 * writer, and the fixtures survive schema migrations without this module knowing the schema.
 */
export async function seedSandbox(options: SeedSandboxOptions): Promise<SeedSandboxResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const request: DaemonRequest = (path, init = {}) =>
    fetchImpl(`${options.daemon.baseUrl}${path}`, {
      ...init,
      headers: { ...init.headers, authorization: daemonAuthorization(options.daemon.token) },
    });
  const registered = await request("/api/repositories", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path: options.repoPath }),
  });
  if (registered.status === 409) return reconcile(options, request);
  if (!registered.ok) {
    throw new Error(
      `Sandbox repository registration failed (${registered.status}): ${await registered.text()}`,
    );
  }
  const projectId = projectIdOf(await registered.json());
  await fileFixtureIssues(request, projectId);
  return { seeded: true, issues: FIXTURE_ISSUES.length };
}

/**
 * A seed killed between registration and the last fixture issue would otherwise freeze the
 * sandbox half-seeded forever: every later boot gets the 409. Re-file the fixtures whenever
 * the registered project has no issues at all.
 */
async function reconcile(
  options: SeedSandboxOptions,
  request: DaemonRequest,
): Promise<SeedSandboxResult> {
  const rootPath = (options.realpath ?? realpathSync)(options.repoPath);
  const projects = await getRecords(request, "/api/projects");
  const project = projects.find((entry) => entry.root_path === rootPath);
  if (project === undefined || typeof project.id !== "string" || project.id === "") {
    throw new Error(`The sandbox repository is registered but no project owns ${rootPath}.`);
  }
  const projectId = project.id;
  const issues = await getRecords(
    request,
    `/api/issues?projectId=${encodeURIComponent(projectId)}`,
  );
  if (issues.length > 0) return { seeded: false, issues: 0 };
  await fileFixtureIssues(request, projectId);
  return { seeded: true, issues: FIXTURE_ISSUES.length };
}

async function fileFixtureIssues(request: DaemonRequest, projectId: string): Promise<void> {
  for (const issue of FIXTURE_ISSUES) {
    const response = await request("/api/issues", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: projectId, ...issue }),
    });
    if (!response.ok) {
      throw new Error(
        `Sandbox issue "${issue.title}" failed (${response.status}): ${await response.text()}`,
      );
    }
  }
}

async function getRecords(
  request: DaemonRequest,
  path: string,
): Promise<Record<string, unknown>[]> {
  const response = await request(path);
  if (!response.ok) {
    throw new Error(`Sandbox lookup ${path} failed (${response.status}): ${await response.text()}`);
  }
  return recordsOf(await response.json());
}

function recordsOf(payload: unknown): Record<string, unknown>[] {
  if (!Array.isArray(payload)) throw new Error("Sandbox lookup returned a non-array payload.");
  return payload.filter(
    (entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null,
  );
}

function projectIdOf(payload: unknown): string {
  if (typeof payload === "object" && payload !== null && "project" in payload) {
    const project = payload.project;
    if (typeof project === "object" && project !== null && "id" in project) {
      const id = project.id;
      if (typeof id === "string" && id !== "") return id;
    }
  }
  throw new Error("Sandbox repository registration returned no project id.");
}
