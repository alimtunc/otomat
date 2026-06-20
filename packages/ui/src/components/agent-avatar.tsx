import { Bot, type LucideIcon } from "lucide-react";
import type { CSSProperties, HTMLAttributes } from "react";

import { cn } from "../lib/utils";
import type { AvatarSize } from "./avatar";

export interface AgentAvatarProps extends HTMLAttributes<HTMLSpanElement> {
  name: string;
  icon?: LucideIcon;
  size?: AvatarSize;
  active?: boolean;
  runtimeTint?: string;
}

const SIZE_CLASS: Record<AvatarSize, string> = {
  sm: "size-4 [&_svg]:size-2.5",
  default: "size-5 [&_svg]:size-3",
  lg: "size-10 [&_svg]:size-5",
};

export function AgentAvatar({
  name,
  icon: Icon = Bot,
  size = "default",
  active = false,
  runtimeTint,
  className,
  style,
  ...rest
}: AgentAvatarProps) {
  const mergedStyle: CSSProperties = runtimeTint
    ? { color: runtimeTint, borderColor: runtimeTint, ...style }
    : (style ?? {});

  return (
    <span
      aria-label={name}
      title={name}
      style={mergedStyle}
      className={cn(
        "grid flex-none place-items-center overflow-hidden rounded-md border border-border bg-surface-3 text-text-secondary",
        active && !runtimeTint && "text-iris-text",
        SIZE_CLASS[size],
        className,
      )}
      {...rest}
    >
      <Icon aria-hidden />
    </span>
  );
}
