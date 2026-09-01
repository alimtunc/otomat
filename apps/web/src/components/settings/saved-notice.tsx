import type { ReactNode } from "react";

export function SavedNotice({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="text-xs text-text-tertiary">
      {children}
    </p>
  );
}
