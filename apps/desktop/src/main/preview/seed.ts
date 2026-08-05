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
}

export interface SeedSandboxResult {
  /** False when the repository was already registered — the fixtures exist, nothing was touched. */
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
  if (registered.status === 409) return { seeded: false, issues: 0 };
  if (!registered.ok) {
    throw new Error(
      `Sandbox repository registration failed (${registered.status}): ${await registered.text()}`,
    );
  }
  const projectId = projectIdOf(await registered.json());
  for (const issue of FIXTURE_ISSUES) {
    const response = await fetchImpl(`${options.daemonUrl}/api/issues`, {
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
  return { seeded: true, issues: FIXTURE_ISSUES.length };
}

function projectIdOf(payload: unknown): string {
  if (typeof payload === "object" && payload !== null) {
    const project = (payload as Record<string, unknown>).project;
    if (typeof project === "object" && project !== null) {
      const id = (project as Record<string, unknown>).id;
      if (typeof id === "string" && id !== "") return id;
    }
  }
  throw new Error("Sandbox repository registration returned no project id.");
}
