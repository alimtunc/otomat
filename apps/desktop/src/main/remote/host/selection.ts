import type { ExecutionHostId, ExecutionHostOperationResult } from "@otomat/domain";

import {
  readExecutionHostsConfigSafe,
  writeExecutionHostsConfigSafe,
  type ExecutionHostsConfig,
} from "./config.js";

/**
 * The durably selected execution host. A candidate selection becomes live only
 * after its write sticks, so a restart always agrees with what the user was told.
 */
export class HostSelection {
  private config: ExecutionHostsConfig;

  constructor(
    private readonly dataDir: string,
    private readonly log: (message: string) => void,
  ) {
    this.config = readExecutionHostsConfigSafe(dataDir, log);
  }

  get activeHostId(): ExecutionHostId {
    return this.config.active === "remote" && this.config.remote !== null ? "remote" : "local";
  }

  get remoteSshAlias(): string | null {
    return this.config.remote?.ssh_alias ?? null;
  }

  commit(patch: Partial<ExecutionHostsConfig>): ExecutionHostOperationResult {
    const candidate = { ...this.config, ...patch };
    const written = writeExecutionHostsConfigSafe(this.dataDir, candidate, this.log);
    if (!written.ok) return written;
    this.config = candidate;
    return { ok: true };
  }
}
