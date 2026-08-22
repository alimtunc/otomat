import {
  Icon,
  IconButton,
  Kbd,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@otomat/ui";

const SHORTCUTS = [
  { keys: ["j", "k"], label: "Previous / next file" },
  { keys: ["n", "p"], label: "Next / previous change" },
  { keys: ["v"], label: "Toggle Reviewed" },
  { keys: ["⌘/Ctrl", "F"], label: "Find in diff" },
  { keys: ["Enter", "⇧ Enter"], label: "Next / previous match" },
  { keys: ["Esc"], label: "Clear search / go back" },
] as const;

export function DiffShortcutsPopover() {
  return (
    <Popover>
      <Tooltip>
        <PopoverTrigger
          render={
            <TooltipTrigger
              render={
                <IconButton
                  size="sm"
                  label="Keyboard shortcuts"
                  icon={<Icon name="info" aria-hidden />}
                />
              }
            />
          }
        />
        <TooltipContent>Keyboard shortcuts</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-64 p-3">
        <p className="mb-2 text-xs font-medium text-foreground">Keyboard shortcuts</p>
        <dl className="flex flex-col gap-2">
          {SHORTCUTS.map((shortcut) => (
            <div
              key={shortcut.label}
              className="flex items-center justify-between gap-3 text-xs text-text-secondary"
            >
              <dt>{shortcut.label}</dt>
              <dd className="flex shrink-0 items-center gap-1">
                {shortcut.keys.map((key) => (
                  <Kbd key={key}>{key}</Kbd>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </PopoverContent>
    </Popover>
  );
}
