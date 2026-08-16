import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RemoteSessionProvider } from "@web/components/shell/remote-session/provider";
import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

export interface Mounted {
  container: HTMLElement;
  /** Renders on the same root, so a query settling between renders is an update, not a fresh mount. */
  rerender: (node: ReactNode) => Promise<void>;
  cleanup: () => Promise<void>;
}

export async function mount(node: ReactNode): Promise<Mounted> {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const draw = async (next: ReactNode): Promise<void> => {
    await act(async () => {
      root.render(next);
    });
  };
  await draw(node);
  return {
    container,
    rerender: draw,
    cleanup: async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

/** Mirrors the app root: the query client, then the host session every surface reads from. */
export async function mountWithQuery(node: ReactNode): Promise<Mounted> {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrap = (child: ReactNode) =>
    createElement(
      QueryClientProvider,
      { client },
      createElement(RemoteSessionProvider, null, child),
    );
  const mounted = await mount(wrap(node));
  // React Query dispatches fetch results on a macrotask; flush two timer ticks before asserting.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return { ...mounted, rerender: (next) => mounted.rerender(wrap(next)) };
}
