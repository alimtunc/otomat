import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, it, vi } from "vitest";

import { CodexRuntimeAdapter } from "#runtime/providers/codex/adapter";
import { MemorySink } from "#runtime/sinks";

import { codexSmokeContexts, startCodexSmokeProvider } from "../support/codex-smoke.js";
import { runtimeRunInput, runtimeSessionRef } from "../support/runtime.js";

it.skipIf(process.env.OTOMAT_CODEX_SMOKE !== "1")(
  "confirms installed Codex permissions across actual adapter turns and external resume",
  async () => {
    const home = mkdtempSync(join(tmpdir(), "codex-smoke-"));
    const close = await startCodexSmokeProvider(home);
    vi.stubEnv("CODEX_HOME", home);
    vi.stubEnv("OPENAI_API_KEY", undefined);
    vi.stubEnv("CODEX_API_KEY", undefined);
    const adapter = new CodexRuntimeAdapter();
    const input = runtimeRunInput({
      cwd: process.cwd(),
      run_dir: home,
      prompt: "Return OK only. Do not run commands or change files.",
      options: { sandbox: "danger-full-access", approval_policy: "never" },
    });
    const signal = AbortSignal.timeout(20000);
    try {
      const initial = await adapter.run(input, new MemorySink(), signal);
      expect(initial.status).toBe("completed");
      const id = initial.provider_session_id;
      if (id === null) throw new Error("Codex did not start a session");
      const session = runtimeSessionRef(id);
      for (let turn = 0; turn < 2; turn += 1) {
        const result = await adapter.resume(session, input, new MemorySink(), signal);
        expect(result.status).toBe("completed");
        expect(result.provider_session_id).toBe(id);
      }
      const contexts = codexSmokeContexts(home, id);
      expect(contexts).toHaveLength(3);
      for (const context of contexts) {
        expect(context).toMatchObject({
          approval_policy: "never",
          sandbox_policy: { type: "danger-full-access" },
        });
      }
      const code = await new Promise<number | null>((resolve, reject) => {
        const child = spawn("codex", ["exec", "--json", "resume", id, "-"], {
          cwd: input.cwd,
          env: {
            PATH: process.env.PATH,
            HOME: process.env.HOME,
            CODEX_HOME: home,
            TMPDIR: process.env.TMPDIR,
          },
          signal,
          stdio: ["pipe", "ignore", "pipe"],
        });
        child.stderr.resume();
        child.stdin.end(input.prompt);
        child.on("error", reject);
        child.on("close", resolve);
      });
      expect(code).toBe(0);
      expect(codexSmokeContexts(home, id).at(-1)).toMatchObject({
        approval_policy: "never",
        sandbox_policy: { type: "read-only" },
      });
      console.log(
        "Codex smoke: launch, Resume and follow-up = danger-full-access/never; external exec resume = read-only/never from current config.",
      );
    } finally {
      vi.unstubAllEnvs();
      await close();
    }
  },
  30000,
);
