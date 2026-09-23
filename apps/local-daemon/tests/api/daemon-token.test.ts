import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DAEMON_TOKEN_ENV, DAEMON_TOKEN_FILE } from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { publishDaemonToken, takeDaemonToken } from "#api";

let dataDir: string;

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), "otomat-token-"));
});

afterEach(() => {
  rmSync(dataDir, { recursive: true, force: true });
});

it("takes the launcher's token out of the env", () => {
  const env: NodeJS.ProcessEnv = { [DAEMON_TOKEN_ENV]: "launcher-token" };

  expect(takeDaemonToken(env)).toEqual({ token: "launcher-token", minted: false });
  expect(env[DAEMON_TOKEN_ENV]).toBeUndefined();
});

it("mints its own token when the launcher handed over none", () => {
  const { token, minted } = takeDaemonToken({ [DAEMON_TOKEN_ENV]: "" });

  expect(minted).toBe(true);
  expect(token).toMatch(/^[\w-]{43}$/);
});

it("publishes a minted token owner-only, replacing a stale file", () => {
  const file = join(dataDir, DAEMON_TOKEN_FILE);
  writeFileSync(file, "stale", { mode: 0o644 });

  publishDaemonToken(dataDir, "minted-token");

  expect(readFileSync(file, "utf8")).toBe("minted-token");
  expect(statSync(file).mode & 0o777).toBe(0o600);
});
