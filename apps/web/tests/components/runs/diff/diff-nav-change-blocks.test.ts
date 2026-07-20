// @vitest-environment happy-dom
import { changeBlockRows } from "@web/components/runs/diff/diff-nav";
import { describe, expect, it } from "vitest";

import { diffLineRow as row } from "#support/diff-dom";

describe("changeBlockRows", () => {
  it("returns the first row of each contiguous changed block", () => {
    const container = document.createElement("table");
    container.innerHTML = [
      row(" ", "ctx-1"),
      row("+", "add-1"),
      row("+", "add-2"),
      row(" ", "ctx-2"),
      row("-", "del-1"),
      row("+", "add-3"),
      row(" ", "ctx-3"),
    ].join("");

    expect(changeBlockRows(container).map((el) => el.id)).toEqual(["add-1", "del-1"]);
  });

  it("returns nothing for a context-only table", () => {
    const container = document.createElement("table");
    container.innerHTML = [row(" ", "ctx-1"), row(" ", "ctx-2")].join("");
    expect(changeBlockRows(container)).toEqual([]);
  });
});
