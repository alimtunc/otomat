import { fileAppearance } from "../lib/file-appearance";
import { cn } from "../lib/utils";
import { Icon } from "./icon";

export interface FileIconProps {
  path: string;
  className?: string;
}

export function FileIcon({ path, className }: FileIconProps) {
  const appearance = fileAppearance(path);
  return (
    <Icon
      name={appearance.icon}
      className={cn("size-3.5 shrink-0", appearance.color, className)}
      aria-hidden
    />
  );
}
