import type { RemoteDeployment } from "./bootstrap/scripts.js";
import { scriptFailure } from "./bootstrap/status.js";
import {
  deployDaemonScript,
  describeDeployFailure,
  parseDeployOutput,
} from "./instances/scripts.js";
import type { runSshScript } from "./ssh/script.js";

// The artifact download does real network work on the host; give it room.
const DEPLOY_TIMEOUT_MS = 180_000;

export interface DeployBundleOptions {
  alias: string;
  /** Where the bundle lands; only its `daemon/` directory is swapped, never its data. */
  deployment: RemoteDeployment;
  /** sha7 of the build to install; the caller has validated its shape. */
  build: string;
  /** GitHub `owner/repo` whose CI publishes the daemon bundles. */
  repo: string;
  runScript: typeof runSshScript;
}

/** A failed install carries its reason as a clause, so each caller writes its own sentence. */
export type DeployBundleResult = { ok: true } | { ok: false; reason: string };

/**
 * Installs the CI bundle for one build into a deployment, and nothing else: no daemon is stopped,
 * started or verified here. The caller decides what a failure means for the daemon that was there —
 * a preview instance simply reports it, an in-place upgrade restarts or rolls back around it.
 */
export async function deployBundle(options: DeployBundleOptions): Promise<DeployBundleResult> {
  const result = await options.runScript({
    alias: options.alias,
    script: deployDaemonScript({
      deployment: options.deployment,
      build: options.build,
      repo: options.repo,
    }),
    timeoutMs: DEPLOY_TIMEOUT_MS,
  });
  if (result.code !== 0) return { ok: false, reason: scriptFailure(result) };
  const outcome = parseDeployOutput(result.stdout);
  if (outcome === null) return { ok: false, reason: "the deploy script reported nothing" };
  if (outcome.kind !== "deployed") return { ok: false, reason: describeDeployFailure(outcome) };
  return { ok: true };
}
