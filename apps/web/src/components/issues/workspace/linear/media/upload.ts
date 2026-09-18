import { LINEAR_UPLOADS_HOST } from "@otomat/domain";

export function isLinearUpload(href: string): boolean {
  const url = URL.parse(href);
  return url !== null && url.protocol === "https:" && url.hostname === LINEAR_UPLOADS_HOST;
}

export function uploadFileName(href: string): string {
  const segment = URL.parse(href)?.pathname.split("/").pop() ?? "";
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
