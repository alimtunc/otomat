import type { ReactNode } from "react";

import { cn } from "../lib/utils";
import { Button, type ButtonProps } from "../primitives/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../primitives/tooltip";

const SIZE_CLASS = {
  default: "size-7 [&>svg]:size-3.75",
  sm: "size-6 [&>svg]:size-3.5",
} as const;

export interface IconButtonProps extends Omit<ButtonProps, "size" | "children" | "aria-label"> {
  label: string;
  icon: ReactNode;
  size?: keyof typeof SIZE_CLASS;
}

export function IconButton({
  className,
  size = "default",
  variant = "ghost",
  label,
  icon,
  title,
  ...props
}: IconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        delay={300}
        render={
          <Button
            variant={variant}
            data-slot="icon-button"
            aria-label={label}
            title={props.disabled ? (title ?? label) : undefined}
            className={cn("shrink-0 gap-0 p-0", SIZE_CLASS[size], className)}
            {...props}
          >
            {icon}
          </Button>
        }
      />
      <TooltipContent>{title ?? label}</TooltipContent>
    </Tooltip>
  );
}
