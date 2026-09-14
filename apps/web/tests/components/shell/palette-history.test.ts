// @vitest-environment happy-dom
import { readPaletteVisits, recordPaletteVisit } from "@web/components/shell/palette/history";
import { afterEach, expect, it } from "vitest";

afterEach(() => localStorage.clear());

it("keeps recent detail routes unique, bounded and scoped to their project host", () => {
  for (let index = 0; index < 8; index += 1)
    recordPaletteVisit("local:p1", { href: `/issues/i${index}`, label: `Issue ${index}` });
  recordPaletteVisit("local:p1", { href: "/issues/i4", label: "Revisited issue" });
  recordPaletteVisit("local:p1", { href: "/settings", label: "Settings" });
  expect(readPaletteVisits("local:p1")).toHaveLength(6);
  expect(readPaletteVisits("local:p1")[0]).toEqual({
    href: "/issues/i4",
    label: "Revisited issue",
  });
  expect(readPaletteVisits("remote:p1")).toEqual([]);
});

it("rejects unsafe or malformed saved destinations", () => {
  localStorage.setItem(
    "otomat.palette-visits",
    JSON.stringify({
      "local:p1": [
        { href: "https://example.com/issues/i1", label: "External" },
        { href: "/runs/r1?step=s1", label: "Review" },
        { href: "/issues/i1" },
      ],
    }),
  );
  expect(readPaletteVisits("local:p1")).toEqual([{ href: "/runs/r1?step=s1", label: "Review" }]);
});
