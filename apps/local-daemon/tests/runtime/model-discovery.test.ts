import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { discoverCodexModels } from "#runtime/providers/codex/models";

import {
  setupStubHarness,
  STUB_BIN,
  STUB_FIXTURES,
  teardownStubHarness,
} from "../support/stub-harness.js";

let worktree: string;

beforeEach(() => {
  worktree = setupStubHarness("otomat-codex-models-");
});

afterEach(() => {
  teardownStubHarness(worktree);
});

describe("codex model discovery", () => {
  it("lists the installed binary's bundled catalog, hidden and flag-shaped slugs excluded", () => {
    process.env["OTOMAT_STUB_FIXTURE"] = join(STUB_FIXTURES, "codex-models.json");

    const result = discoverCodexModels(STUB_BIN);

    expect(result.discovery.status).toBe("ok");
    expect(result.discovery.detail).toMatch(/codex debug models --bundled/);
    expect(result.models).toEqual([
      {
        id: "gpt-5.6-sol",
        label: "GPT-5.6-Sol",
        description: "Latest frontier agentic coding model.",
        source: "discovered",
      },
      {
        id: "gpt-5.2",
        label: "GPT-5.2",
        description: "Older frontier model.",
        source: "discovered",
      },
    ]);
  });

  it("reports an unsupported catalog when the installed version rejects the subcommand", () => {
    process.env["OTOMAT_STUB_EXIT"] = "2";
    process.env["OTOMAT_STUB_STDERR"] = "error: unrecognized subcommand 'models'";

    const result = discoverCodexModels(STUB_BIN);

    expect(result.discovery).toEqual({
      status: "unsupported",
      detail: "error: unrecognized subcommand 'models'",
    });
    expect(result.models).toEqual([]);
  });

  it("reports a failed catalog on a non-zero exit that is not an argument refusal", () => {
    process.env["OTOMAT_STUB_EXIT"] = "1";
    process.env["OTOMAT_STUB_STDERR"] = "error: could not read the model catalog";

    const result = discoverCodexModels(STUB_BIN);

    expect(result.discovery.status).toBe("failed");
    expect(result.models).toEqual([]);
  });

  it("never invents entries when the output is not a catalog", () => {
    process.env["OTOMAT_STUB_FIXTURE"] = join(STUB_FIXTURES, "codex-frames.jsonl");

    const result = discoverCodexModels(STUB_BIN);

    expect(result.discovery.status).toBe("failed");
    expect(result.models).toEqual([]);
  });

  it("fails honestly when the binary cannot be spawned", () => {
    const result = discoverCodexModels("/nonexistent/codex-binary");

    expect(result.discovery.status).toBe("failed");
    expect(result.discovery.detail).toMatch(/ENOENT/);
    expect(result.models).toEqual([]);
  });
});
