import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Icon,
  IconButton,
} from "@otomat/ui";

export function TabActionsMenu({
  index,
  count,
  onMove,
}: {
  index: number;
  count: number;
  onMove: (offset: number) => void;
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        render={
          <IconButton
            label="Tab actions"
            disabled={index < 0}
            icon={<Icon name="more-horizontal" aria-hidden />}
          />
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem disabled={index <= 0} onClick={() => onMove(-1)}>
          Move tab left
        </DropdownMenuItem>
        <DropdownMenuItem disabled={index < 0 || index === count - 1} onClick={() => onMove(1)}>
          Move tab right
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
