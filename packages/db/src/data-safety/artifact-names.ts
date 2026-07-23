import { isSanitizedIsoTimestamp, isUuidV4 } from "@otomat/domain";

function generatedNameBody(filename: string, prefix: string, suffix: string): string | null {
  if (!filename.startsWith(prefix) || !filename.endsWith(suffix)) return null;
  return filename.slice(prefix.length, -suffix.length);
}

export function isUuidV4ArtifactName(filename: string, prefix: string, suffix: string): boolean {
  const body = generatedNameBody(filename, prefix, suffix);
  return body !== null && isUuidV4(body);
}

export function isTimestampedUuidV4ArtifactName(
  filename: string,
  prefix: string,
  suffix: string,
): boolean {
  const body = generatedNameBody(filename, prefix, suffix);
  if (body === null) return false;
  const uuid = body.slice(-36);
  const timestamp = body.slice(0, -37);
  return body.at(-37) === "-" && isSanitizedIsoTimestamp(timestamp) && isUuidV4(uuid);
}
