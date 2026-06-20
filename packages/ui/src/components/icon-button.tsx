import type { ReactNode } from "react";

import { cn } from "../lib/utils";
import { Button, type ButtonProps } from "../primitives/button";

const SIZE_CLASS = {
  default: "size-7 [&>svg]:size-3.75",
  sm: "size-6 [&>svg]:size-3.5",
} as const;

export interface IconButtonProps extends Omit<
  ButtonProps,
  "size" | "variant" | "children" | "aria-label"
> {
  label: string;
  icon: ReactNode;
  size?: keyof typeof SIZE_CLASS;
}

export function IconButton({
  className,
  size = "default",
  label,
  icon,
  ...props
}: IconButtonProps) {
  return (
    <Button
      variant="ghost"
      data-slot="icon-button"
      aria-label={label}
      title={label}
      className={cn("gap-0 p-0", SIZE_CLASS[size], className)}
      {...props}
    >
      {icon}
    </Button>
  );
}
