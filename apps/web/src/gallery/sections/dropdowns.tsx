import {
  Button,
  Chip,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
  Icon,
  IconButton,
  Kbd,
  LiveDot,
} from "@otomat/ui";

import { Row, Section } from "../section";

export function DropdownsSection() {
  return (
    <Section title="Dropdown menus">
      <Row>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button size="sm">
                <Icon name="bot" />
                Assign agent
                <Icon name="chevron-down" className="size-3.25" />
              </Button>
            }
          />
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Agents</DropdownMenuLabel>
            <DropdownMenuItem>
              <Icon name="bot" />
              Implementer
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Icon name="bot" />
              Reviewer
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              Unassign
              <DropdownMenuShortcut>⌫</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Chip tone="iris" className="cursor-pointer">
                <LiveDot tone="iris" live size={7} />
                running
                <Icon name="chevron-down" className="size-2.75" />
              </Chip>
            }
          />
          <DropdownMenuContent align="start">
            <DropdownMenuItem>Pause</DropdownMenuItem>
            <DropdownMenuItem>Stop</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button size="sm">
                <Icon name="cpu" />
                claude-sonnet-4.5
                <Icon name="chevron-down" className="size-3.25" />
              </Button>
            }
          />
          <DropdownMenuContent align="start">
            <DropdownMenuItem>claude-sonnet-4.5</DropdownMenuItem>
            <DropdownMenuItem>claude-opus-4.1</DropdownMenuItem>
            <DropdownMenuItem>gpt-5-codex</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={<IconButton label="Actions" icon={<Icon name="more-horizontal" />} />}
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem>
              Copy link
              <DropdownMenuShortcut>
                <Kbd>⌘C</Kbd>
              </DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem>Rename</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-danger">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Row>
      <div className="mt-2 text-xs text-text-tertiary">
        Click to open · Esc / outside to close · positioned under the trigger, flips up near the
        viewport edge.
      </div>
    </Section>
  );
}
