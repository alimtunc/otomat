import type { LucideProps } from "lucide-react";

import { icons, type IconName } from "../lib/icon-registry";
import { cn } from "../lib/utils";

export type { IconName } from "../lib/icon-registry";

export type IconSize = "xs" | "sm" | "md" | "lg";

const SIZE_CLASS: Record<IconSize, string> = {
  xs: "size-3",
  sm: "size-4",
  md: "size-5",
  lg: "size-6",
};

export interface IconProps extends Omit<LucideProps, "size"> {
  name: IconName;
  size?: IconSize;
}

export function Icon({ name, size, className, ...props }: IconProps) {
  const Glyph = icons[name];
  return <Glyph className={size ? cn(SIZE_CLASS[size], className) : className} {...props} />;
}
