import type { CSSProperties, HTMLAttributes } from "react";

import { cn } from "../lib/utils";

export type AvatarSize = "sm" | "default" | "lg";
export type AvatarShape = "circle" | "square";

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  name: string;
  src?: string;
  size?: AvatarSize;
  shape?: AvatarShape;
  color?: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

const SIZE_CLASS: Record<AvatarSize, string> = {
  sm: "size-4 text-[9px]",
  default: "size-5 text-[10px]",
  lg: "size-10 text-[15px]",
};

function shapeClassFor(shape: AvatarShape, size: AvatarSize): string {
  if (shape === "square") return "rounded-sm";
  return size === "lg" ? "rounded-lg" : "rounded-full";
}

export function Avatar({
  name,
  src,
  size = "default",
  shape = "circle",
  color,
  className,
  style,
  ...rest
}: AvatarProps) {
  const shapeClass = shapeClassFor(shape, size);

  const mergedStyle: CSSProperties = {
    backgroundColor: color ?? "var(--surface-3)",
    ...style,
  };

  return (
    <span
      aria-label={name}
      title={name}
      style={mergedStyle}
      className={cn(
        "grid flex-none place-items-center overflow-hidden font-semibold text-on-accent",
        SIZE_CLASS[size],
        shapeClass,
        className,
      )}
      {...rest}
    >
      {src ? (
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <span aria-hidden>{initials(name)}</span>
      )}
    </span>
  );
}
