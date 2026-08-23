import { sep } from "node:path";

import type { BuildInfo } from "#shared/build-info";
import { OTOMAT_GITHUB_REPO } from "#shared/constants";

export const RELEASES_URL = `https://github.com/${OTOMAT_GITHUB_REPO}/releases/latest`;

/** macOS installs applications here; Squirrel replaces the bundle in place and needs to own it. */
const APPLICATIONS_DIR = `${sep}Applications${sep}`;

export interface InstallabilityInput {
  build: BuildInfo;
  platform: NodeJS.Platform;
  packaged: boolean;
  appPath: string;
}

export type Installability = { installable: true } | { installable: false; reason: string };

export function describeInstallability(input: InstallabilityInput): Installability {
  if (!input.packaged) {
    return { installable: false, reason: "A checkout updates through git, not through a release." };
  }
  if (input.platform !== "darwin") {
    return { installable: false, reason: "Otomat only updates itself on macOS for now." };
  }
  if (input.build.channel === "preview") {
    return {
      installable: false,
      reason: `This is the preview for pull request ${String(input.build.pr_number)}; it never replaces the installed Otomat.`,
    };
  }
  if (input.build.channel !== "stable" || !input.build.signed) {
    return {
      installable: false,
      reason: "This build is not the signed release, so macOS would refuse the replacement.",
    };
  }
  if (!input.appPath.includes(APPLICATIONS_DIR)) {
    return {
      installable: false,
      reason: "Otomat is running from outside Applications; move it there to update in place.",
    };
  }
  return { installable: true };
}
