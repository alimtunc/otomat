import { Spinner } from "@otomat/ui";
import { CenteredState } from "@web/components/shell/centered-state";
import type { ReactNode } from "react";

export function CenteredLoading({ children }: { children: ReactNode }) {
  return (
    <CenteredState fill="flex">
      <Spinner motion="breathe" size={24}>
        {children}
      </Spinner>
    </CenteredState>
  );
}
