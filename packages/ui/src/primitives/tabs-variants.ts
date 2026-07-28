import { cva } from "class-variance-authority";

export const tabsListVariants = cva("flex items-center gap-0.5 border-b border-border-subtle", {
  variants: {
    density: {
      compact: "",
      comfortable: "",
    },
    bordered: {
      true: "",
      false: "border-b-0",
    },
  },
  defaultVariants: {
    density: "compact",
    bordered: true,
  },
});

export const tabTriggerVariants = cva(
  [
    "relative inline-flex items-center gap-1.5 px-2.5 font-medium",
    "text-text-secondary outline-none",
    "transition-[color] duration-[--motion-fast] ease-standard",
    "hover:text-foreground",
    "data-[active]:text-foreground",
    "disabled:pointer-events-none disabled:opacity-50",
    "after:absolute after:left-2 after:right-2 after:bottom-[-1px] after:h-0.5 after:rounded-[2px] after:bg-iris after:opacity-0",
    "data-[active]:after:opacity-100",
    "[&_svg]:size-3.5 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      density: {
        compact: "h-8.5 text-sm",
        comfortable: "h-10 text-md",
      },
    },
    defaultVariants: {
      density: "compact",
    },
  },
);
