import type { IconName } from "./icon-registry";

const APPEARANCES: ReadonlyArray<{ pattern: RegExp; icon: IconName; color: string }> = [
  { pattern: /\.(ts|tsx|mts|cts)$/i, icon: "file-code", color: "text-info" },
  { pattern: /\.(js|jsx|mjs|cjs)$/i, icon: "file-code", color: "text-warning" },
  { pattern: /\.(json|jsonc|json5)$/i, icon: "file-json", color: "text-warning" },
  { pattern: /\.(css|scss|less|html|vue|svelte)$/i, icon: "code", color: "text-iris-text" },
  { pattern: /\.(png|jpe?g|gif|webp|svg|ico|avif)$/i, icon: "image", color: "text-success" },
  { pattern: /\.(md|mdx|markdown)$/i, icon: "book", color: "text-info" },
  {
    pattern: /\.(ya?ml|toml|ini|conf)$|(^|\/)(dockerfile|makefile|\.\w+rc)$/i,
    icon: "settings",
    color: "text-text-secondary",
  },
  { pattern: /\.(sh|bash|zsh|fish)$/i, icon: "terminal", color: "text-success" },
  { pattern: /\.(py|rs|go|java|c|cpp|h|rb|php|sql)$/i, icon: "file-code", color: "text-info" },
];

export function fileAppearance(path: string): { icon: IconName; color: string } {
  return (
    APPEARANCES.find(({ pattern }) => pattern.test(path)) ?? {
      icon: "file-text",
      color: "text-text-tertiary",
    }
  );
}
