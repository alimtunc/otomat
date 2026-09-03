import { safeHref } from "./href";

export type MarkdownMediaKind = "image" | "video";

const IMAGE_EXTENSIONS = new Set(["avif", "gif", "jpeg", "jpg", "png", "webp"]);
const VIDEO_EXTENSIONS = new Set(["mov", "mp4", "ogv", "webm"]);

export function safeRemoteMediaHref(raw: string): string | null {
  const destination = safeHref(raw);
  if (destination === null) return null;
  try {
    return new URL(destination).protocol === "https:" ? destination : null;
  } catch {
    return null;
  }
}

export function markdownMediaKind(
  href: string,
  fallback: MarkdownMediaKind | null = null,
): MarkdownMediaKind | null {
  const destination = safeRemoteMediaHref(href);
  if (destination === null) return null;
  const pathname = new URL(destination).pathname.toLowerCase();
  const slash = pathname.lastIndexOf("/");
  const dot = pathname.lastIndexOf(".");
  const extension = dot <= slash ? "" : pathname.slice(dot + 1);
  if (IMAGE_EXTENSIONS.has(extension)) return "image";
  if (VIDEO_EXTENSIONS.has(extension)) return "video";
  return fallback;
}
