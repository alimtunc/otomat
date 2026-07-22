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
  ThemeProvider,
  resolveStatus,
} from "@otomat/ui";
import { act, type ReactNode } from "react";
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
});
