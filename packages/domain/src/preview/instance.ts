/** What may name a build in host-side paths, scripts and routes: exactly the CI's 7-hex short sha. */
export const PREVIEW_BUILD_SHA = /^[0-9a-f]{7}$/;

export interface PreviewInstanceDeployment {
  homeSuffix: string;
  port: number;
}

const INSTANCE_PORT_BASE = 43100;
const INSTANCE_PORT_SPAN = 900;

/**
 * Both the desktop shell and CI provisioning derive an instance here: two derivations would let a
 * desktop preview and a web preview of one commit reuse each other's data directory on different
 * ports. An unidentifiable build shares one "unknown" slot rather than falling back to the stable
 * deployment.
 */
export function previewInstanceDeployment(build: string | null): PreviewInstanceDeployment {
  const key = build !== null && PREVIEW_BUILD_SHA.test(build) ? build : "unknown";
  let hash = 0;
  for (const char of key) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % INSTANCE_PORT_SPAN;
  return { homeSuffix: `.otomat/instances/${key}`, port: INSTANCE_PORT_BASE + hash };
}
