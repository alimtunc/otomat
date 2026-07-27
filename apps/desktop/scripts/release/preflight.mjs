// The gate a signed release passes before anything is built: complete Apple credentials, an
// architecture this pipeline can actually produce, and a tag that agrees with the packaged version.
import { formatSigningProblems, resolveSigningEnvironment } from "./env.mjs";
import { assertReleasableArch, assertTagMatchesVersion } from "./metadata.mjs";

/**
 * @param {{ env: Record<string, string | undefined>, arch: string, version: string,
 *   fileExists: (path: string) => boolean }} input
 * @returns {{ teamId: string, apiKeyPath: string, apiKeyId: string, apiIssuer: string }}
 */
export function preflight(input) {
  const resolved = resolveSigningEnvironment(input.env, input.fileExists);
  if (!resolved.ok) throw new Error(formatSigningProblems(resolved.problems));
  assertReleasableArch(input.arch);
  assertTagMatchesVersion(input.env.GITHUB_REF, input.version);
  return resolved.signing;
}
