// @vitest-environment happy-dom
import { useThreadAutoscroll } from "@web/components/runs/conversation/use-thread-autoscroll";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";

import { stubResizeObserver } from "#support/resize-observer";
import { controlScroll } from "#support/scroll-control";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function Thread() {
  const scroll = useThreadAutoscroll("run-1:step-1", null);
  return (
    <div ref={scroll.viewportRef} data-pinned={scroll.pinned}>
      <div ref={scroll.contentRef}>Conversation</div>
    </div>
  );
}

it("keeps following when a layout scroll event arrives before the resize observer", async () => {
  const observers = stubResizeObserver();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<Thread />));
    const viewport = container.querySelector<HTMLDivElement>("[data-pinned]");
    if (!viewport) throw new Error("Missing conversation viewport");
    const scroll = controlScroll(viewport, 400, 2000);
    await act(async () => observers.resize());
    expect(scroll.top()).toBe(scroll.maxTop());

    await act(async () => {
      scroll.setContentHeight(3200);
      viewport.dispatchEvent(new Event("scroll"));
      observers.resize();
    });

    expect(scroll.top()).toBe(scroll.maxTop());
    expect(viewport.dataset.pinned).toBe("true");
    await act(async () => scroll.dragTo(600));
    expect(viewport.dataset.pinned).toBe("false");
    await act(async () => {
      scroll.setContentHeight(4000);
      observers.resize();
    });
    expect(scroll.top()).toBe(600);
  } finally {
    await act(async () => root.unmount());
    container.remove();
    observers.restore();
  }
});
