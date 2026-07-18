import { accessSync, constants, statSync } from "node:fs";
import { delimiter, join } from "node:path";

/** Fake runtime is opt-in only (Vitest, or an explicit OTOMAT_ENABLE_FAKE_RUNTIME); never in a normal production daemon. */
export function isFakeRuntimeEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.OTOMAT_ENABLE_FAKE_RUNTIME === "1" || env.OTOMAT_ENABLE_FAKE_RUNTIME === "true") {
    return true;
  }
  return env.NODE_ENV === "test" || Boolean(env.VITEST);
}

function isExecutableFile(path: string): boolean {
  try {
    if (!statSync(path).isFile()) return false;
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** PATH lookup only — the availability probe must never launch the provider binary. */
export function resolveBinaryPath(
  binary: string,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const searchPath = env.PATH ?? "";
  for (const dir of searchPath.split(delimiter)) {
    if (dir.length === 0) continue;
    const candidate = join(dir, binary);
    if (isExecutableFile(candidate)) return candidate;
  }
  return null;
}
