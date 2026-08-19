import { realpathSync } from "node:fs";

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
  daemonUrl: string;
  repoPath: string;
  fetchImpl?: typeof fetch;
  /** Canonicalizer for `repoPath`; a remote sandbox path is already canonical and has no local file. */
  realpath?: (path: string) => string;
}

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
  const registered = await fetchImpl(`${options.daemonUrl}/api/repositories`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path: options.repoPath }),
  });
  if (registered.status === 409) return reconcile(options, fetchImpl);
  if (!registered.ok) {
    throw new Error(
      `Sandbox repository registration failed (${registered.status}): ${await registered.text()}`,
    );
  }
  const projectId = projectIdOf(await registered.json());
  await fileFixtureIssues(options.daemonUrl, projectId, fetchImpl);
  return { seeded: true, issues: FIXTURE_ISSUES.length };
}

/**
 * A seed killed between registration and the last fixture issue would otherwise freeze the
 * sandbox half-seeded forever: every later boot gets the 409. Re-file the fixtures whenever
 * the registered project has no issues at all.
 */
async function reconcile(
  options: SeedSandboxOptions,
  fetchImpl: typeof fetch,
): Promise<SeedSandboxResult> {
  const rootPath = (options.realpath ?? realpathSync)(options.repoPath);
  const projects = await getRecords(fetchImpl, `${options.daemonUrl}/api/projects`);
  const project = projects.find((entry) => entry.root_path === rootPath);
  if (project === undefined || typeof project.id !== "string" || project.id === "") {
    throw new Error(`The sandbox repository is registered but no project owns ${rootPath}.`);
  }
  const projectId = project.id;
  const issues = await getRecords(
    fetchImpl,
    `${options.daemonUrl}/api/issues?projectId=${encodeURIComponent(projectId)}`,
  );
  if (issues.length > 0) return { seeded: false, issues: 0 };
  await fileFixtureIssues(options.daemonUrl, projectId, fetchImpl);
  return { seeded: true, issues: FIXTURE_ISSUES.length };
}

async function fileFixtureIssues(
  daemonUrl: string,
  projectId: string,
  fetchImpl: typeof fetch,
): Promise<void> {
  for (const issue of FIXTURE_ISSUES) {
    const response = await fetchImpl(`${daemonUrl}/api/issues`, {
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
  fetchImpl: typeof fetch,
  url: string,
): Promise<Record<string, unknown>[]> {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Sandbox lookup ${url} failed (${response.status}): ${await response.text()}`);
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
