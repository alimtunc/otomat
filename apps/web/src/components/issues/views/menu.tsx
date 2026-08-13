import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Icon,
  IconButton,
} from "@otomat/ui";

export interface IssueViewMenuProps {
  name: string;
  editable: boolean;
  movable: { left: boolean; right: boolean };
  onRename: () => void;
  onDuplicate: () => void;
  onMove: (offset: number) => void;
  onDelete: () => void;
}

export function IssueViewMenu({
  name,
  editable,
  movable,
  onRename,
  onDuplicate,
  onMove,
  onDelete,
}: IssueViewMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <IconButton
            size="sm"
            label={`View actions for ${name}`}
            icon={<Icon name="more-horizontal" />}
          />
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onDuplicate}>Duplicate view</DropdownMenuItem>
        <DropdownMenuItem disabled={!editable} onClick={onRename}>
          Rename view
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!movable.left} onClick={() => onMove(-1)}>
          Move left
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!movable.right} onClick={() => onMove(1)}>
          Move right
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-danger" disabled={!editable} onClick={onDelete}>
          Delete view
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
