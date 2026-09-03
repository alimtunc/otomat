import { cn } from "../lib/utils";

export interface ReconnectingBarProps {
  label?: string;
  className?: string;
}

const STYLES = `
@keyframes otomat-reconnect-indeterminate{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}
.otomat-reconnect-bar::before{
  content:"";position:absolute;inset:0;width:40%;
  background:var(--iris-solid);
  animation:otomat-reconnect-indeterminate 1.1s var(--ease) infinite;
}
@media (prefers-reduced-motion:reduce){
  .otomat-reconnect-bar::before{
    animation:none;width:100%;
    background:repeating-linear-gradient(90deg,var(--iris-solid) 0 8px,transparent 8px 16px);
  }
}
`;

export function ReconnectingBar({ label = "Reconnecting…", className }: ReconnectingBarProps) {
  return (
    <>
      <style>{STYLES}</style>
      <div
        role="progressbar"
        aria-label={label}
        aria-busy="true"
        className={cn(
          "otomat-reconnect-bar fixed inset-x-0 top-0 h-0.5 overflow-hidden",
          className,
        )}
        style={{ zIndex: "var(--z-overlay)" }}
      />
    </>
  );
}
