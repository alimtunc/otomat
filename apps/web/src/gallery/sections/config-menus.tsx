import {
  ConfigMenu,
  ConfigMenuCheck,
  ConfigMenuChoice,
  ConfigMenuContent,
  ConfigMenuNote,
  ConfigMenuProblem,
  ConfigMenuSubmenu,
  ConfigMenuTrigger,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuSeparator,
} from "@otomat/ui";

import { CONFIG_MENU_LONG_VALUE, CONFIG_MENU_SCROLLED_CHOICES } from "../gallery.fixtures";
import { Row } from "../row";
import { Section } from "../section";

export function ConfigMenusSection() {
  return (
    <Section title="Config menus (compact summary · label/value rows · bounded popups)">
      <Row align="start">
        <ConfigMenu>
          <ConfigMenuTrigger label="Short" summary="Claude Code · Default · Auto" />
          <ConfigMenuContent aria-label="Short">
            <ConfigMenuSubmenu label="Agent" value="Claude Code">
              <DropdownMenuRadioGroup value="claude">
                <ConfigMenuChoice value="claude" label="Claude Code" />
                <ConfigMenuChoice value="codex" label="Codex CLI" />
              </DropdownMenuRadioGroup>
            </ConfigMenuSubmenu>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Reset to defaults</DropdownMenuItem>
          </ConfigMenuContent>
        </ConfigMenu>

        <div className="w-44">
          <ConfigMenu>
            <ConfigMenuTrigger
              label="Long"
              summary={CONFIG_MENU_LONG_VALUE}
              detail={CONFIG_MENU_LONG_VALUE}
            />
            <ConfigMenuContent aria-label="Long">
              <ConfigMenuSubmenu
                label="Model"
                value={CONFIG_MENU_LONG_VALUE}
                hint="Listed by `codex debug models --bundled` from the installed binary."
              >
                <ConfigMenuChoice
                  value="long"
                  label="Extra high"
                  hint="xhigh"
                  description="Extra high reasoning depth for complex problems."
                />
              </ConfigMenuSubmenu>
            </ConfigMenuContent>
          </ConfigMenu>
        </div>

        <ConfigMenu>
          <ConfigMenuTrigger label="Scrolled" summary="42 branches" />
          <ConfigMenuContent aria-label="Scrolled">
            <DropdownMenuRadioGroup value="main">
              {CONFIG_MENU_SCROLLED_CHOICES.map((branch) => (
                <ConfigMenuChoice key={branch} value={branch} label={branch} />
              ))}
            </DropdownMenuRadioGroup>
          </ConfigMenuContent>
        </ConfigMenu>

        <ConfigMenu>
          <ConfigMenuTrigger label="Pending" summary="Checking the installed CLI…" pending />
          <ConfigMenuContent aria-label="Pending">
            <ConfigMenuNote>Checking what the installed CLI accepts…</ConfigMenuNote>
          </ConfigMenuContent>
        </ConfigMenu>

        <ConfigMenu>
          <ConfigMenuTrigger label="Error" summary="Claude Code · Default" />
          <ConfigMenuContent aria-label="Error">
            <ConfigMenuSubmenu label="Filters" value="Any status">
              <ConfigMenuCheck label="Running" checked onCheckedChange={() => undefined} />
              <ConfigMenuCheck label="Failed" checked={false} onCheckedChange={() => undefined} />
            </ConfigMenuSubmenu>
            <DropdownMenuSeparator />
            <ConfigMenuProblem
              message="The daemon could not report what this runtime accepts."
              onRetry={() => undefined}
            />
          </ConfigMenuContent>
        </ConfigMenu>
      </Row>
      <div className="mt-2 text-xs text-text-tertiary">
        Enter or ↓ opens · ↑↓ moves · → enters a submenu · ← leaves it · Esc closes. Every popup is
        width-bounded, height-capped and scrolls inside; a value clamps to two lines and keeps its
        full text on hover and in its accessible name.
      </div>
    </Section>
  );
}
