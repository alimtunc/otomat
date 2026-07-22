import { DropdownMenuTrigger } from "@otomat/ui";
import type { ReactNode } from "react";

const TRIGGER_CLASS =
  "-my-0.5 inline-flex min-w-0 items-center justify-end gap-1.5 rounded-md px-1.5 py-0.5 text-sm text-foreground transition-colors duration-100 hover:bg-surface-2 disabled:pointer-events-none";

export function Trigger({ disabled, children }: { disabled: boolean; children: ReactNode }) {
  return (
    <DropdownMenuTrigger disabled={disabled} className={TRIGGER_CLASS}>
      {children}
    </DropdownMenuTrigger>
  );
}
