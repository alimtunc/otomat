/** Link destinations arrive from Linear and from agents, so only schemes that cannot
    execute anything survive. A rejected destination renders as inert text instead. */
const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

/** A browser reads `java\tscript:` as `javascript:`; drop the padding before deciding. */
const IGNORED_CHARACTERS = /[\s\p{Cc}]/gu;

const RELATIVE_BASE = "https://markdown.invalid/";

export function safeHref(raw: string): string | null {
  const value = raw.replace(IGNORED_CHARACTERS, "");
  if (value.length === 0) return null;
  try {
    const url = new URL(value, RELATIVE_BASE);
    return SAFE_PROTOCOLS.has(url.protocol) ? value : null;
  } catch {
    return null;
  }
}

/** In-document anchors stay in the current view; every other link leaves the cockpit. */
export function isExternalHref(href: string): boolean {
  return !href.startsWith("#");
}
