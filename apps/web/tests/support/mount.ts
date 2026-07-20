import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

export interface Mounted {
  container: HTMLElement;
  cleanup: () => Promise<void>;
}

export async function mount(node: ReactNode): Promise<Mounted> {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(node);
  });
  return {
    container,
    cleanup: async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}
