import type { IconName } from "@otomat/ui";
import { asMember } from "@web/lib/coerce";

export const PROJECT_ICONS = [
  { name: "folder", label: "Folder" },
  { name: "briefcase", label: "Briefcase" },
  { name: "users", label: "People" },
  { name: "server", label: "Server" },
  { name: "globe", label: "Globe" },
  { name: "database", label: "Database" },
  { name: "code", label: "Code" },
  { name: "terminal", label: "Terminal" },
  { name: "rocket", label: "Rocket" },
  { name: "layers", label: "Layers" },
  { name: "bot", label: "Bot" },
  { name: "palette", label: "Palette" },
  { name: "book", label: "Book" },
  { name: "shopping-cart", label: "Cart" },
  { name: "star", label: "Star" },
  { name: "zap", label: "Lightning" },
] as const satisfies readonly { name: IconName; label: string }[];

export type ProjectIconName = (typeof PROJECT_ICONS)[number]["name"];

export function asProjectIcon(value: unknown): ProjectIconName | null {
  return asMember(
    value,
    PROJECT_ICONS.map((icon) => icon.name),
  );
}
