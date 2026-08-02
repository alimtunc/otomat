/**
 * Build identity of this daemon. The dist bundle bakes the git commit in at
 * build time (tsdown define); a source run reads the env the desktop shell
 * injects, and reports null when neither is present.
 */
export function daemonBuild(): string | null {
  const sha = process.env.OTOMAT_BUILD_SHA;
  return sha === undefined || sha === "" ? null : sha;
}
