import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, it, vi } from "vitest";

import { CodexRuntimeAdapter } from "#runtime/providers/codex/adapter";
import { MemorySink } from "#runtime/sinks";

import { codexSmokeContexts, startCodexSmokeProvider } from "../support/codex-smoke.js";
import { runtimeRunInput, runtimeSessionRef } from "../support/runtime.js";

it.skipIf(process.env.OTOMAT_CODEX_SMOKE !== "1")(
  "confirms automatic reviewer and confined sandbox in native launch and resumed turn contexts",
  async () => {
    const home = mkdtempSync(join(tmpdir(), "codex-reviewer-smoke-"));
    const close = await startCodexSmokeProvider(home);
    vi.stubEnv("CODEX_HOME", home);
    vi.stubEnv("OPENAI_API_KEY", undefined);
    vi.stubEnv("CODEX_API_KEY", undefined);
    try {
      const adapter = new CodexRuntimeAdapter();
      for (const sandbox of ["read-only", "workspace-write"]) {
        const input = runtimeRunInput({
          cwd: process.cwd(),
          run_dir: home,
          prompt: "Return OK without tools.",
          options: { sandbox, approval_policy: "on-request", approvals_reviewer: "auto_review" },
        });
        const result = await adapter.run(input, new MemorySink(), AbortSignal.timeout(15000));
        expect(result.status).toBe("completed");
        const id = result.provider_session_id;
        if (id === null) throw new Error("No native session ID");
        for (let turn = 0; turn < 2; turn += 1) {
          expect(
            (
              await adapter.resume(
                runtimeSessionRef(id),
                input,
                new MemorySink(),
                AbortSignal.timeout(15000),
              )
            ).status,
          ).toBe("completed");
        }
        const contexts = codexSmokeContexts(home, id);
        expect(contexts).toHaveLength(3);
        for (const context of contexts)
          expect(context).toMatchObject({
            approval_policy: "on-request",
            approvals_reviewer: "auto_review",
            sandbox_policy: { type: sandbox },
          });
      }
    } finally {
      vi.unstubAllEnvs();
      await close();
    }
  },
  100000,
);

it.skipIf(process.env.OTOMAT_CODEX_SMOKE !== "1" || process.platform !== "linux")(
  "allows temporary Git inspection and worktree writes while protecting Git configuration",
  async () => {
    const root = mkdtempSync(join(tmpdir(), "codex-git-smoke-"));
    const home = join(root, "codex-home");
    const cwd = join(root, "repository");
    mkdirSync(home);
    mkdirSync(cwd);
    writeFileSync(
      join(home, "config.toml"),
      'sandbox_mode="workspace-write"\napproval_policy="on-request"\napprovals_reviewer="auto_review"\n',
    );
    const execute = (
      binary: string,
      args: string[],
    ): Promise<{ code: number | null; stderr: string }> =>
      new Promise((resolve, reject) => {
        const child = spawn(binary, args, {
          cwd,
          env: { PATH: process.env.PATH, HOME: process.env.HOME, CODEX_HOME: home },
          stdio: ["ignore", "ignore", "pipe"],
          signal: AbortSignal.timeout(10000),
        });
        let stderr = "";
        child.stderr.on("data", (data: Buffer) => {
          stderr += data.toString();
        });
        child.on("error", reject);
        child.on("close", (code) => resolve({ code, stderr }));
      });
    expect((await execute("git", ["init", "--quiet"])).code).toBe(0);
    const original = readFileSync(join(cwd, ".git/config"), "utf8");
    const allowed = await execute("codex", [
      "sandbox",
      "sh",
      "-c",
      "printf allowed > allowed.txt && git status --porcelain",
    ]);
    expect(allowed, allowed.stderr).toMatchObject({ code: 0 });
    expect(readFileSync(join(cwd, "allowed.txt"), "utf8")).toBe("allowed");
    expect(
      (await execute("codex", ["sandbox", "sh", "-c", "printf forbidden >> .git/config"])).code,
    ).not.toBe(0);
    expect(readFileSync(join(cwd, ".git/config"), "utf8")).toBe(original);
  },
  30000,
);
