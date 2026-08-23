import type { DesktopUpdateFeed } from "@otomat/domain";

const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

interface Version {
  numbers: [number, number, number];
  tags: string[];
}

function parse(version: string): Version | null {
  const match = SEMVER.exec(version.trim());
  if (match === null) return null;
  return {
    numbers: [Number(match[1]), Number(match[2]), Number(match[3])],
    tags: match[4] === undefined ? [] : match[4].split("."),
  };
}

/** Numeric identifiers order below alphanumeric ones, as semver precedence defines it. */
function compareTag(a: string | undefined, b: string | undefined): number {
  if (a === undefined) return b === undefined ? 0 : -1;
  if (b === undefined) return 1;
  const [left, right] = [Number(a), Number(b)];
  if (!Number.isNaN(left) && !Number.isNaN(right)) return Math.sign(left - right);
  if (!Number.isNaN(left)) return -1;
  if (!Number.isNaN(right)) return 1;
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function compare(a: Version, b: Version): number {
  for (const index of [0, 1, 2] as const) {
    const difference = a.numbers[index] - b.numbers[index];
    if (difference !== 0) return Math.sign(difference);
  }
  // A version with no prerelease tag outranks the same numbers carrying one.
  if (a.tags.length === 0 && b.tags.length === 0) return 0;
  if (a.tags.length === 0) return 1;
  if (b.tags.length === 0) return -1;
  for (let index = 0; index < Math.max(a.tags.length, b.tags.length); index += 1) {
    const order = compareTag(a.tags[index], b.tags[index]);
    if (order !== 0) return order;
  }
  return 0;
}

/** A version this app cannot parse takes the narrower feed rather than the wider one. */
export function feedOf(version: string): DesktopUpdateFeed {
  const parsed = parse(version);
  return parsed !== null && parsed.tags.length > 0 ? "prerelease" : "stable";
}

export function replaces(current: string, candidate: string): boolean {
  if (feedOf(current) !== feedOf(candidate)) return false;
  const [from, to] = [parse(current), parse(candidate)];
  if (from === null || to === null) return false;
  return compare(to, from) > 0;
}
