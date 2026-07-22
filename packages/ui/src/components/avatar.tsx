import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar";
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

// Deterministic per-name hue so initials stay legible on both themes.
function nameColor(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) | 0;
  return `hsl(${Math.abs(hash) % 360} 48% 46%)`;
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
    backgroundColor: color ?? nameColor(name),
    color: "#fff",
    ...style,
  };

  return (
    <AvatarPrimitive.Root
      aria-label={name}
      title={name}
      style={mergedStyle}
      className={cn(
        "grid flex-none place-items-center overflow-hidden font-semibold",
        SIZE_CLASS[size],
        shapeClass,
        className,
      )}
      {...rest}
    >
      {src ? <AvatarPrimitive.Image src={src} alt="" className="size-full object-cover" /> : null}
      <AvatarPrimitive.Fallback aria-hidden>{initials(name)}</AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
