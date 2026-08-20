// @vitest-environment happy-dom
import { scrollIntoContainer, scrollParent } from "@web/components/runs/diff/scroll";
import { afterEach, describe, expect, it, vi } from "vitest";

import { domRect } from "#support/diff-dom";
import { controlScroll } from "#support/scroll-control";

function stubRect(element: HTMLElement, top: number, height: number): void {
  element.getBoundingClientRect = () => domRect(top, height);
}

function reviewer() {
  const shell = document.createElement("div");
  const cards = document.createElement("div");
  const card = document.createElement("section");
  // happy-dom ignores the `overflow` shorthand; only the longhand makes an element a scroller.
  shell.style.overflowY = "auto";
  cards.style.overflowY = "auto";
  shell.append(cards);
  cards.append(card);
  document.body.append(shell);
  return { shell, cards, card };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("the reveal's scroll container", () => {
  it("is the nearest scrolling ancestor, not the first parent", () => {
    const { cards, card } = reviewer();
    const inner = document.createElement("div");
    card.append(inner);

    expect(scrollParent(inner)).toBe(cards);
  });
});

describe("revealing inside the reviewer", () => {
  it("scrolls the file's own container and leaves the shell where it was", () => {
    const { shell, cards, card } = reviewer();
    const outer = controlScroll(shell, 700, 3_000);
    const inner = controlScroll(cards, 500, 2_000);
    inner.dragTo(100);
    stubRect(cards, 40, 500);
    stubRect(card, 300, 120);

    scrollIntoContainer(card, "start");

    expect(inner.top()).toBe(360);
    expect(outer.top()).toBe(0);
  });

  it("centres a comment anchor rather than pinning it to the top edge", () => {
    const { cards, card } = reviewer();
    const inner = controlScroll(cards, 500, 2_000);
    stubRect(cards, 0, 500);
    stubRect(card, 400, 100);

    scrollIntoContainer(card, "center");

    expect(inner.top()).toBe(200);
  });

  it("falls back to the element's own reveal when nothing around it scrolls", () => {
    const card = document.createElement("section");
    document.body.append(card);
    const reveal = vi.fn();
    card.scrollIntoView = reveal;

    scrollIntoContainer(card, "start");

    expect(reveal).toHaveBeenCalledWith({ block: "start" });
  });
});
