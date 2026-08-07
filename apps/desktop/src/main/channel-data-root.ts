import { isAbsolute, join, resolve } from "node:path";

import type { DesktopChannel } from "#shared/channel";
import { APP_DATA_ROOT_ENV } from "#shared/constants";

const PREVIEW_DIRECTORY_NAME = "Otomat Preview";
const LOCAL_DIRECTORY_NAME = "Otomat Local";
const UNKNOWN_DIRECTORY_NAME = "Otomat Unknown";

export interface ChannelDataRootOptions {
  /** `BuildInfo.channel`: what this build declared, or the verdict for one that declared nothing. */
  channel: DesktopChannel;
  /** `BuildInfo.pr_number`: the pull request a preview was packaged for. */
  prNumber: number | null;
  /** Electron's `appData` directory — the parent of the stable install's userData. */
  appData: string;
  env: NodeJS.ProcessEnv;
}

/**
 * Where a channel keeps its data — SQLite, logs, the single-instance lock Electron keys on
 * userData. Null means "leave Electron's own userData alone": `stable` owns `Otomat`, and a dev
 * checkout is already split per worktree. Every other channel gets a sibling directory, so a
 * preview under test, an ad-hoc local package and the signed install never share a database — and
 * a build that could not name its channel lands in `unknown` rather than in anyone else's data.
 *
 * The name depends on the channel alone, never on the commit: two `local` packages built from two
 * commits of `main` open the same profile.
 */
export function resolveChannelDataRoot(options: ChannelDataRootOptions): string | null {
  const name = channelDirectoryName(options.channel, options.prNumber);
  if (name === null) return null;
  return join(appDataRoot(options), name);
}

function channelDirectoryName(channel: DesktopChannel, prNumber: number | null): string | null {
  switch (channel) {
    case "stable":
    case "dev":
      return null;
    case "local":
      return LOCAL_DIRECTORY_NAME;
    case "preview":
      return prNumber === null
        ? PREVIEW_DIRECTORY_NAME
        : `${PREVIEW_DIRECTORY_NAME} PR ${String(prNumber)}`;
    case "unknown":
      return UNKNOWN_DIRECTORY_NAME;
  }
}

/** The packaged smoke points this at a scratch directory so the gate never opens a real profile. */
function appDataRoot(options: ChannelDataRootOptions): string {
  const override = options.env[APP_DATA_ROOT_ENV]?.trim() ?? "";
  if (override === "") return options.appData;
  if (!isAbsolute(override)) {
    throw new Error(`${APP_DATA_ROOT_ENV} must be an absolute path, received "${override}".`);
  }
  return resolve(override);
}
