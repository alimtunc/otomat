import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Icon,
  IconButton,
} from "@otomat/ui";
import { PROJECT_HOME_NAV, WORKSPACE_NAV } from "@web/components/shell/nav-items";
import type { Ref } from "react";

import type { DeskPage } from "./state";

export function NewTabMenu({
  triggerRef,
  onPick,
}: {
  triggerRef: Ref<HTMLButtonElement>;
  onPick: (page: DeskPage) => void;
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        render={
          <IconButton ref={triggerRef} label="New tab" icon={<Icon name="plus" aria-hidden />} />
        }
      />
      <DropdownMenuContent align="end" className="w-56" style={{ transition: "none" }}>
        {[PROJECT_HOME_NAV, ...WORKSPACE_NAV].map((item) => (
          <DropdownMenuItem
            key={item.to}
            onClick={() => onPick({ href: item.to, label: item.label })}
          >
            <Icon name={item.icon} aria-hidden />
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
