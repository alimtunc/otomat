import type { IconName } from "../lib/icon-registry";
import { Icon } from "./icon";

export function ProjectGlyph({ name, icon }: { name: string; icon?: IconName }) {
  return (
    <div
      className="grid h-6 w-6 flex-none place-items-center rounded-md text-[13px] font-bold text-on-accent"
      style={{ background: "linear-gradient(160deg,var(--iris-hover),var(--iris-active))" }}
      aria-hidden
    >
      {icon === undefined ? (
        name.slice(0, 1).toUpperCase()
      ) : (
        <Icon name={icon} className="size-3.5! text-on-accent!" />
      )}
    </div>
  );
}
