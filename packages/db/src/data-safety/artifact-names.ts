import { isUuidV4 } from "@otomat/domain";

function generatedNameBody(filename: string, prefix: string, suffix: string): string | null {
  if (!filename.startsWith(prefix) || !filename.endsWith(suffix)) return null;
  return filename.slice(prefix.length, -suffix.length);
}

export function isUuidV4ArtifactName(filename: string, prefix: string, suffix: string): boolean {
  const body = generatedNameBody(filename, prefix, suffix);
  return body !== null && isUuidV4(body);
}
