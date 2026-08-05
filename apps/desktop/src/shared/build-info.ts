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
  /** Pull request this preview was packaged for; null for stable, release and dev builds. */
  pr_number: number | null;
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
  return { ...info, signed: record.signed, pr_number: readPrNumber(record.pr_number) };
}

/** Absent in artifacts packaged before previews were named after their pull request. */
function readPrNumber(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error("The build metadata field pr_number is not a pull request number.");
  }
  return value;
}

/** A build that cannot name its own commit: a checkout run, or unreadable packaged metadata. */
export function unidentifiedBuildInfo(version: string, electron: string): BuildInfo {
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
  };
}
