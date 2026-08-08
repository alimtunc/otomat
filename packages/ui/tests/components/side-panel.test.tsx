// @vitest-environment happy-dom
import {
  AppShell,
  AppSidebar,
  ResizablePanel,
  ResizablePanelGroup,
  SidePanel,
  SidePanelToggle,
  usePanelGroupLayout,
} from "@otomat/ui";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { render, unmountAll } from "#test-support/render";

// happy-dom runs no layout engine, and the library measures a group as the sum of its
// panels' offsets, so size every element to a share of a group of PANELS_PER_GROUP.
const GROUP_SIZE = 1000;
const PANELS_PER_GROUP = 2;
for (const property of ["offsetWidth", "offsetHeight"]) {
  Object.defineProperty(HTMLElement.prototype, property, {
    configurable: true,
    get: () => GROUP_SIZE / PANELS_PER_GROUP,
  });
}

// happy-dom ships no `ariaDisabled`, and the library reads `!== null` as "disabled",
// which would leave every separator inert.
Object.defineProperty(Element.prototype, "ariaDisabled", {
  configurable: true,
  get(this: Element) {
    return this.getAttribute("aria-disabled");
  },
});

// Base UI's scroll area drives its transitions off the Web Animations API.
Element.prototype.getAnimations = () => [];

// A wide viewport with a fine pointer, so the shell starts with its sidebar open.
window.matchMedia = ((query: string) => ({
  matches: query.includes("min-width"),
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
})) as unknown as typeof window.matchMedia;

const FILES_GROUP = "test.files";
const FILES_DEFAULT_WIDTH = 264;
// AppShell's default railWidth, which its sidebar collapses to.
const SHELL_RAIL_WIDTH = 56;
const asPercent = (px: number) => (px / GROUP_SIZE) * 100;

function storedSize(groupId: string, panelId: string): number {
  const raw = window.localStorage.getItem(`react-resizable-panels:${groupId}`);
  if (raw === null) throw new Error(`no stored layout for ${groupId}`);
  const size = (JSON.parse(raw) as Record<string, number | undefined>)[panelId];
  if (size === undefined) throw new Error(`${groupId} stored no size for ${panelId}`);
  return size;
}

function separatorOf(container: HTMLElement) {
  const separator = container.querySelector<HTMLElement>('[role="separator"]');
  if (separator === null) throw new Error("no separator rendered");
  return separator;
}

function toggleOf(container: HTMLElement, panelId: string) {
  const toggle = container.querySelector<HTMLButtonElement>(`button[aria-controls="${panelId}"]`);
  if (toggle === null) throw new Error(`no toggle rendered for ${panelId}`);
  return toggle;
}

async function click(button: HTMLButtonElement) {
  await act(async () => {
    button.click();
  });
}

async function press(target: HTMLElement | Window, key: string) {
  await act(async () => {
    target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key }));
  });
}

async function doubleClick(element: HTMLElement) {
  await act(async () => {
    element.dispatchEvent(
      new MouseEvent("dblclick", { bubbles: true, cancelable: true, clientX: 0, clientY: 0 }),
    );
  });
}

function FileBrowser() {
  const layout = usePanelGroupLayout(FILES_GROUP);
  return (
    <ResizablePanelGroup {...layout}>
      <SidePanel
        id="files"
        label="Changed files"
        side="left"
        defaultSize={FILES_DEFAULT_WIDTH}
        minSize={168}
        maxSize="40%"
      >
        <div>
          <SidePanelToggle />
          <span>file list</span>
        </div>
      </SidePanel>
      <ResizablePanel id="diff" minSize="40%">
        diff
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

function Shell() {
  return (
    <AppShell sidebar={<AppSidebar>navigation</AppSidebar>} topbar={<header />}>
      content
    </AppShell>
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(async () => {
  await unmountAll();
});

describe("side panels", () => {
  it("names the handle, orients it and keeps it keyboard reachable", async () => {
    const separator = separatorOf(await render(<FileBrowser />));

    expect(separator.getAttribute("aria-label")).toBe("Resize Changed files");
    expect(separator.getAttribute("aria-orientation")).toBe("vertical");
    expect(separator.getAttribute("tabindex")).toBe("0");
  });

  it("collapses and expands from the toggle, swapping the panel for its rail", async () => {
    const container = await render(<FileBrowser />);

    expect(toggleOf(container, "files").getAttribute("aria-label")).toBe("Collapse Changed files");
    expect(toggleOf(container, "files").getAttribute("aria-expanded")).toBe("true");
    expect(container.textContent).toContain("file list");

    await click(toggleOf(container, "files"));

    expect(toggleOf(container, "files").getAttribute("aria-label")).toBe("Expand Changed files");
    expect(toggleOf(container, "files").getAttribute("aria-expanded")).toBe("false");
    expect(container.textContent).not.toContain("file list");
    expect(container.textContent).toContain("Changed files");

    await click(toggleOf(container, "files"));

    expect(container.textContent).toContain("file list");
    expect(toggleOf(container, "files").getAttribute("aria-expanded")).toBe("true");
  });

  it("reopens collapsed after a remount", async () => {
    const first = await render(<FileBrowser />);
    await click(toggleOf(first, "files"));
    expect(window.localStorage.getItem("otomat.panel.files.collapsed")).toBe("true");

    await unmountAll();
    const second = await render(<FileBrowser />);

    expect(second.textContent).not.toContain("file list");
    expect(toggleOf(second, "files").getAttribute("aria-label")).toBe("Expand Changed files");
  });

  it("resizes from the keyboard and restores the default width on double-click", async () => {
    const container = await render(<FileBrowser />);
    const separator = separatorOf(container);

    await press(separator, "ArrowRight");
    const widened = storedSize(FILES_GROUP, "files");
    expect(widened).toBeGreaterThan(asPercent(FILES_DEFAULT_WIDTH));

    await press(separator, "ArrowLeft");
    expect(storedSize(FILES_GROUP, "files")).toBeLessThan(widened);

    await press(separator, "ArrowRight");
    await doubleClick(separator);

    expect(storedSize(FILES_GROUP, "files")).toBeCloseTo(asPercent(FILES_DEFAULT_WIDTH), 0);
  });

  it("mounts against a stored layout that names fewer panels than the group renders", async () => {
    window.localStorage.setItem(
      `react-resizable-panels:${FILES_GROUP}`,
      JSON.stringify({ diff: 100 }),
    );

    const container = await render(<FileBrowser />);

    expect(container.textContent).toContain("file list");
    expect(separatorOf(container).getAttribute("aria-label")).toBe("Resize Changed files");
  });

  it("restores a persisted width on the next mount", async () => {
    const first = await render(<FileBrowser />);
    await press(separatorOf(first), "ArrowRight");
    const persisted = storedSize(FILES_GROUP, "files");

    await unmountAll();
    await render(<FileBrowser />);

    expect(storedSize(FILES_GROUP, "files")).toBeCloseTo(persisted, 1);
  });
});

describe("app shell sidebar", () => {
  it("collapses from its own control and from the shortcut", async () => {
    const container = await render(<Shell />);
    const toggle = () => toggleOf(container, "sidebar");

    expect(toggle().getAttribute("aria-label")).toBe("Collapse Sidebar");

    await click(toggle());

    expect(toggle().getAttribute("aria-label")).toBe("Expand Sidebar");
    expect(window.localStorage.getItem("otomat.panel.sidebar.collapsed")).toBe("true");
    expect(storedSize("otomat.shell", "sidebar")).toBeCloseTo(asPercent(SHELL_RAIL_WIDTH), 0);

    await press(window, "[");

    expect(toggle().getAttribute("aria-label")).toBe("Collapse Sidebar");
    expect(window.localStorage.getItem("otomat.panel.sidebar.collapsed")).toBe("false");
  });

  it("keeps the sidebar collapsed across a remount", async () => {
    const first = await render(<Shell />);
    await click(toggleOf(first, "sidebar"));

    await unmountAll();
    const second = await render(<Shell />);

    expect(toggleOf(second, "sidebar").getAttribute("aria-label")).toBe("Expand Sidebar");
    expect(storedSize("otomat.shell", "sidebar")).toBeCloseTo(asPercent(SHELL_RAIL_WIDTH), 0);
  });
});
