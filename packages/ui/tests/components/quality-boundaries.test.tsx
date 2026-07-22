// @vitest-environment happy-dom
import {
  AppShell,
  Avatar,
  Button,
  CommandPalette,
  Field,
  FieldLabel,
  Input,
  RunStatusChip,
  SidebarNavItem,
  ThemeProvider,
  TimelineEventRow,
  resolveStatus,
} from "@otomat/ui";
import { act, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const mounted: Array<() => Promise<void>> = [];

async function render(node: ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(node);
  });
  mounted.push(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
  return container;
}

function CustomNav({ children, ...props }: ComponentPropsWithoutRef<"button">) {
  return (
    <button data-testid="custom-nav" {...props}>
      {children}
    </button>
  );
}

afterEach(async () => {
  for (const cleanup of mounted.splice(0)) await cleanup();
});

describe("shared UI boundaries", () => {
  it("leaves toast infrastructure to the application root", async () => {
    await render(
      <ThemeProvider>
        <AppShell sidebar={<aside />} topbar={<header />}>
          content
        </AppShell>
      </ThemeProvider>,
    );

    expect(document.querySelector('section[aria-label^="Notifications"]')).toBeNull();
  });

  it("keeps canonical status labels while chips own lowercase presentation", async () => {
    expect(resolveStatus("run", "review_ready").label).toBe("Review ready");

    const container = await render(<RunStatusChip status="review_ready" />);
    expect(container.querySelector('[role="status"]')?.classList.contains("lowercase")).toBe(true);
  });

  it("renders command icons from the canonical icon registry", async () => {
    await render(
      <CommandPalette
        open
        onOpenChange={() => undefined}
        groups={[
          {
            id: "commands",
            heading: "Commands",
            commands: [
              {
                id: "new-issue",
                label: "New issue",
                icon: "plus",
                onSelect: () => undefined,
              },
            ],
          },
        ]}
      />,
    );

    expect(document.querySelector(".lucide-plus")).not.toBeNull();
  });

  it("forwards value changes through the Base UI input contract", async () => {
    let value = "";
    const container = await render(
      <Input
        aria-label="Name"
        onValueChange={(nextValue) => {
          value = nextValue;
        }}
      />,
    );
    const input = container.querySelector("input");
    expect(input).not.toBeNull();

    await act(async () => {
      if (input === null) return;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, "Otomat");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(value).toBe("Otomat");
  });

  it("keeps disabled buttons focusable through the Base UI button contract", async () => {
    const container = await render(
      <Button disabled focusableWhenDisabled>
        Retry
      </Button>,
    );
    const button = container.querySelector("button");

    expect(button?.getAttribute("aria-disabled")).toBe("true");
    expect(button?.hasAttribute("disabled")).toBe(false);
  });

  it("uses the canonical iris loading indicator for every button variant", async () => {
    await render(
      <Button variant="outline" loading>
        Sync now
      </Button>,
    );

    const loadingStyles =
      document.querySelector<HTMLStyleElement>("#otomat-btn-loading")?.textContent;

    expect(loadingStyles).toContain("border:2px solid var(--border-strong)");
    expect(loadingStyles).toContain("border-top-color:var(--iris-solid)");
    expect(loadingStyles).not.toContain("border:2px solid currentColor");
  });

  it("shows avatar initials while an image is unavailable", async () => {
    const container = await render(<Avatar name="Ada Lovelace" src="/missing-avatar.png" />);

    expect(container.textContent).toContain("AL");
  });

  it("connects a Base UI field label and external validation to its input", async () => {
    const container = await render(
      <Field invalid error="Name is required">
        <FieldLabel>Name</FieldLabel>
        <Input />
      </Field>,
    );
    const label = container.querySelector("label");
    const input = container.querySelector("input");
    const error = container.querySelector('[role="alert"]');

    expect(label?.htmlFor).toBe(input?.id);
    expect(input?.getAttribute("aria-invalid")).toBe("true");
    expect(input?.getAttribute("aria-describedby")).toBe(error?.id);
  });

  it("preserves the timeline row selection contract", async () => {
    let selections = 0;
    const container = await render(
      <TimelineEventRow
        type="run.lifecycle"
        provenance="otomat"
        summary="Run started"
        at="2026-07-22T20:00:00.000Z"
        selected
        isNew
        onSelect={() => {
          selections += 1;
        }}
      />,
    );
    const row = container.querySelector<HTMLElement>("[role='button']");

    expect(row?.tagName).toBe("DIV");
    expect(row?.getAttribute("aria-current")).toBe("true");
    expect(row?.style.background).toBe("var(--selected)");

    await act(async () => {
      row?.click();
      row?.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
    });

    expect(selections).toBe(2);
  });

  it("preserves the legacy polymorphic sidebar item contract", async () => {
    const container = await render(<SidebarNavItem icon="layers" label="Custom" as={CustomNav} />);

    expect(container.querySelector("[data-testid='custom-nav']")).not.toBeNull();
  });

  it("keeps href authoritative when a sidebar link also handles clicks", async () => {
    const container = await render(
      <SidebarNavItem icon="layers" label="Gallery" href="/gallery.html" onClick={() => {}} />,
    );
    const link = container.querySelector("a");

    expect(link?.getAttribute("href")).toBe("/gallery.html");
  });
});
