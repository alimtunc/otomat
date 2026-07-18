// @vitest-environment happy-dom
import { AppShell, CommandPalette, RunStatusChip, ThemeProvider, resolveStatus } from "@otomat/ui";
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
});
