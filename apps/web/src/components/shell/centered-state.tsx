import type { ReactNode } from "react";

const FILL_CLASS = {
  full: "grid h-full place-items-center p-6",
  flex: "grid flex-1 place-items-center p-6",
} as const;

/** Centers a full-pane Empty/Error state; `flex` fills a flex-column parent where h-full cannot stretch. */
export function CenteredState({
  fill = "full",
  children,
}: {
  fill?: keyof typeof FILL_CLASS;
  children: ReactNode;
}) {
  return <div className={FILL_CLASS[fill]}>{children}</div>;
}
