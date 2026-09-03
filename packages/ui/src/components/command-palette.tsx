import { Dialog } from "@base-ui/react/dialog";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useState } from "react";

import { cn } from "../lib/utils";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandItemId,
  CommandItemRight,
  CommandList,
} from "../primitives/command";
import { Icon, type IconName } from "./icon";

export type CommandPaletteCommand = {
  id: string;
  label: string;
  icon?: IconName;
  shortcut?: ReactNode;
  refId?: string;
  keywords?: string;
  disabled?: boolean;
  onSelect: () => void | Promise<void>;
};

export type CommandPaletteGroup = {
  id: string;
  heading: string;
  notice?: ReactNode;
  commands: CommandPaletteCommand[];
};

export type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  search: string;
  onSearchChange: (search: string) => void;
  groups: CommandPaletteGroup[];
  placeholder?: string;
  className?: string;
};

// A keyboard surface opened many times a day: no transition either way, like Raycast.
const overlayClass = "fixed inset-0 bg-overlay backdrop-blur-[1px]";

const contentClass =
  "fixed left-1/2 top-[14vh] w-[min(620px,92vw)] -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-popover shadow-[var(--shadow-modal)] outline-none";

export function CommandPalette({
  open,
  onOpenChange,
  search,
  onSearchChange,
  groups,
  placeholder = "Type a command or search…",
  className,
}: CommandPaletteProps) {
  const [pending, setPending] = useState<string | null>(null);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        setPending(null);
        onSearchChange("");
      }
      onOpenChange(next);
    },
    [onOpenChange, onSearchChange],
  );

  const run = useCallback(
    (command: CommandPaletteCommand) => {
      const result = command.onSelect();
      if (result instanceof Promise) {
        setPending(command.id);
        result.finally(() => {
          handleOpenChange(false);
        });
      } else {
        handleOpenChange(false);
      }
    },
    [handleOpenChange],
  );

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange} modal>
      <Dialog.Portal>
        <Dialog.Backdrop className={overlayClass} style={{ zIndex: "var(--z-command)" }} />
        <Dialog.Popup
          className={cn(contentClass, className)}
          style={{ zIndex: "var(--z-command)" }}
          aria-label="Command palette"
        >
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <Dialog.Description className="sr-only">Search and run commands</Dialog.Description>
          <Command loop shouldFilter={false}>
            <CommandInput placeholder={placeholder} value={search} onValueChange={onSearchChange} />
            <CommandList>
              {groups.map((group) => (
                <CommandGroup key={group.id} heading={group.heading}>
                  {group.notice === undefined ? null : (
                    <div role="presentation">{group.notice}</div>
                  )}
                  {group.commands.map((command) => {
                    const isPending = pending === command.id;
                    let leading: ReactNode = null;
                    if (isPending) {
                      leading = <Loader2 className="animate-spin motion-reduce:animate-none" />;
                    } else if (command.icon) {
                      leading = <Icon name={command.icon} aria-hidden />;
                    }
                    return (
                      <CommandItem
                        key={command.id}
                        value={command.id}
                        disabled={command.disabled || pending !== null}
                        onSelect={() => run(command)}
                      >
                        {command.refId ? <CommandItemId>{command.refId}</CommandItemId> : null}
                        {leading}
                        <span className="truncate">{command.label}</span>
                        {command.shortcut ? (
                          <CommandItemRight>{command.shortcut}</CommandItemRight>
                        ) : null}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
