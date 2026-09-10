// @vitest-environment happy-dom
import { useNotificationAnchor } from "@web/components/runs/conversation/interaction/use-notification-anchor";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { mount } from "#support/mount";

function AnchorProbe() {
  return <li ref={useNotificationAnchor("interaction-request")}>Request</li>;
}

afterEach(() => {
  window.location.hash = "";
  vi.useRealTimers();
});

it("reveals a matching interaction after delayed content mounts and initial layout finishes", async () => {
  window.location.hash = "#interaction-request";
  vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] });
  const mounted = await mount(null);
  try {
    await mounted.rerender(<AnchorProbe />);
    const node = mounted.container.querySelector("li");
    if (node === null) throw new Error("Missing interaction");
    node.scrollIntoView = vi.fn();
    await act(async () => {
      vi.advanceTimersToNextFrame();
    });
    expect(node.scrollIntoView).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersToNextFrame();
    });
    expect(node.scrollIntoView).toHaveBeenCalledExactlyOnceWith({
      block: "center",
      behavior: "instant",
    });
    await mounted.rerender(<AnchorProbe />);
    await act(async () => {
      vi.advanceTimersToNextFrame();
    });
    expect(node.scrollIntoView).toHaveBeenCalledOnce();
  } finally {
    await mounted.cleanup();
  }
});
