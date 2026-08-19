import { isPackagedChannel, type DesktopChannel } from "#shared/channel";

/** Identity of the build a user is actually running, written into the app at packaging time. */
export interface BuildInfo {
  version: string;
  commit: string;
  commit_short: string;
  committed_at: string;
  arch: string;
  platform: string;
  electron: string;
  /** True only for a Developer ID signed, notarized release. */
  signed: boolean;
  /** Pull request this preview was packaged for; null on every other channel. */
  pr_number: number | null;
  /** Distribution channel: what this build's identity, data roots and upgrade path are. */
  channel: DesktopChannel;
}

const UNIDENTIFIED = "unknown";

function readString(record: Record<string, unknown>, field: string): string {
  const value = record[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`The build metadata field ${field} is missing.`);
  }
  return value;
}

export function parseBuildInfo(contents: string): BuildInfo {
  const parsed: unknown = JSON.parse(contents);
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("The build metadata is not an object.");
  }
  // SAFETY: checked above to be a non-null object; every field read is validated after.
  const record = parsed as Record<string, unknown>;
  const info = {
    version: readString(record, "version"),
    commit: readString(record, "commit"),
    commit_short: readString(record, "commit_short"),
    committed_at: readString(record, "committed_at"),
    arch: readString(record, "arch"),
    platform: readString(record, "platform"),
    electron: readString(record, "electron"),
  };
  const signed: unknown = record.signed;
  if (typeof signed !== "boolean") {
    throw new Error("The build metadata field signed is missing.");
  }
  const channel: unknown = record.channel;
  if (!isPackagedChannel(channel)) {
    throw new Error("The build metadata field channel is not a distribution channel.");
  }
  if (channel === "stable" && !signed) {
    throw new Error("The build metadata claims the stable channel without a signature.");
  }
  const prNumber = readPrNumber(record.pr_number);
  if (channel === "preview" && prNumber === null) {
    throw new Error("The build metadata claims the preview channel without a pull request.");
  }
  if (channel !== "preview" && prNumber !== null) {
    throw new Error("The build metadata carries a pull request outside the preview channel.");
  }
  return { ...info, signed, pr_number: prNumber, channel };
}

function readPrNumber(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error("The build metadata field pr_number is not a pull request number.");
  }
  return value;
}

function anonymousBuildInfo(version: string, electron: string, channel: DesktopChannel): BuildInfo {
  return {
    version,
    commit: UNIDENTIFIED,
    commit_short: UNIDENTIFIED,
    committed_at: UNIDENTIFIED,
    arch: process.arch,
    platform: process.platform,
    electron,
    signed: false,
    pr_number: null,
    channel,
  };
}

/** A checkout run: no packaged metadata exists, and the dev channel expects none. */
export function devBuildInfo(version: string, electron: string): BuildInfo {
  return anonymousBuildInfo(version, electron, "dev");
}

/**
 * A packaged build whose metadata is missing or invalid. It names no commit and claims no channel,
 * so every location it resolves is the isolated `unknown` one — never `local` or `stable` data.
 */
export function unidentifiedBuildInfo(version: string, electron: string): BuildInfo {
  return anonymousBuildInfo(version, electron, "unknown");
}
