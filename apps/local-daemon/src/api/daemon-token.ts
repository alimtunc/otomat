import { randomBytes } from "node:crypto";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { DAEMON_TOKEN_ENV, DAEMON_TOKEN_FILE } from "@otomat/domain";

export interface DaemonToken {
  token: string;
  /** True when no launcher handed one over, so the daemon must publish it itself. */
  minted: boolean;
}

/** Taken out of the env so no worker or provider inherits it. */
export function takeDaemonToken(env: NodeJS.ProcessEnv = process.env): DaemonToken {
  const given = env[DAEMON_TOKEN_ENV];
  delete env[DAEMON_TOKEN_ENV];
  if (given !== undefined && given !== "") return { token: given, minted: false };
  return { token: randomBytes(32).toString("base64url"), minted: true };
}

/** Called once the server listens: a second daemon that fails to bind must not replace the live token. */
export function publishDaemonToken(dataDir: string, token: string): void {
  const file = join(dataDir, DAEMON_TOKEN_FILE);
  rmSync(file, { force: true });
  writeFileSync(file, token, { mode: 0o600, flag: "wx" });
}
