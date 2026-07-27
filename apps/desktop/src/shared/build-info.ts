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
}

const UNPACKAGED = "unpackaged";

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
  const record: Record<string, unknown> = { ...parsed };
  const info = {
    version: readString(record, "version"),
    commit: readString(record, "commit"),
    commit_short: readString(record, "commit_short"),
    committed_at: readString(record, "committed_at"),
    arch: readString(record, "arch"),
    platform: readString(record, "platform"),
    electron: readString(record, "electron"),
  };
  if (typeof record.signed !== "boolean") {
    throw new Error("The build metadata field signed is missing.");
  }
  return { ...info, signed: record.signed };
}

/** Stand-in for a checkout run: there is no packaged artifact, so there is no commit to claim. */
export function developmentBuildInfo(version: string, electron: string): BuildInfo {
  return {
    version,
    commit: UNPACKAGED,
    commit_short: UNPACKAGED,
    committed_at: UNPACKAGED,
    arch: process.arch,
    platform: process.platform,
    electron,
    signed: false,
  };
}
