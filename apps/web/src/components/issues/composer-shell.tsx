import type { ReactNode } from "react";

export interface ComposerShellProps {
  children: ReactNode;
  controls: ReactNode;
  submit: ReactNode;
}

export function ComposerShell({ children, controls, submit }: ComposerShellProps) {
  return (
    <div className="flex flex-col rounded-lg border border-input bg-background focus-within:border-iris-ring">
      <div className="max-h-64 overflow-y-auto px-2.5 py-2">{children}</div>
      <div className="flex flex-wrap items-center gap-1.5 border-t border-border-subtle p-1.5">
        {controls}
        <div className="ml-auto">{submit}</div>
      </div>
    </div>
  );
}
