// @vitest-environment happy-dom
import { Markdown } from "@otomat/ui";
import { afterEach, expect, it } from "vitest";

import { render, unmountAll } from "#test-support/render";

afterEach(unmountAll);

it("renders a description as a document instead of raw syntax", async () => {
  const container = await render(
    <Markdown
      value={[
        "# Title",
        "",
        "Some **bold** and `inline` text.",
        "",
        "- first",
        "- second",
        "",
        "> quoted",
        "",
        "---",
      ].join("\n")}
    />,
  );

  expect(container.querySelector("h1")?.textContent).toBe("Title");
  expect(container.querySelector("strong")?.textContent).toBe("bold");
  expect(container.querySelectorAll("li")).toHaveLength(2);
  expect(container.querySelector("blockquote")?.textContent).toBe("quoted");
  expect(container.querySelector("hr")).not.toBeNull();
  expect(container.textContent).not.toContain("**");
  expect(container.textContent).not.toContain("# Title");
});

it("renders a GFM table and strikethrough", async () => {
  const container = await render(
    <Markdown value={["| Check | State |", "| --- | --- |", "| lint | ~~red~~ |"].join("\n")} />,
  );

  expect([...container.querySelectorAll("th")].map((cell) => cell.textContent)).toEqual([
    "Check",
    "State",
  ]);
  expect(container.querySelector("td")?.textContent).toBe("lint");
  expect(container.querySelector("del")?.textContent).toBe("red");
  expect(container.textContent).not.toContain("|");
});

it("never interprets embedded HTML as markup", async () => {
  const container = await render(
    <Markdown value={'<img src=x onerror="alert(1)"><script>alert(2)</script> after'} />,
  );

  expect(container.querySelector("img")).toBeNull();
  expect(container.querySelector("script")).toBeNull();
  expect(container.textContent).toContain("<script>alert(2)</script>");
  expect(container.textContent).toContain("after");
});

it("drops an unsafe destination and keeps its label readable", async () => {
  const container = await render(<Markdown value="[click me](javascript:alert(1))" />);

  expect(container.querySelector("a")).toBeNull();
  expect(container.textContent).toContain("click me");
});

it("opens an external link safely and names its destination", async () => {
  const container = await render(<Markdown value="[docs](https://otomat.dev/docs)" />);
  const link = container.querySelector("a");

  expect(link?.getAttribute("href")).toBe("https://otomat.dev/docs");
  expect(link?.getAttribute("target")).toBe("_blank");
  expect(link?.getAttribute("rel")).toBe("noreferrer noopener");
  expect(link?.getAttribute("title")).toBe("https://otomat.dev/docs");
  expect(link?.textContent).toContain("docs");
  expect(link?.querySelector(".sr-only")?.textContent).toContain("opens https://otomat.dev/docs");
});

it("anchors the off-screen destination label to its own link", async () => {
  const container = await render(<Markdown value="[docs](https://otomat.dev/docs)" />);
  const offscreen = container.querySelector(".sr-only");

  expect(offscreen?.closest(".relative")).toBe(container.querySelector("a"));
});

it("resolves a reference link and leaves its definition out of the prose", async () => {
  const container = await render(
    <Markdown value={"See [the doc][ref].\n\n[ref]: https://otomat.dev/doc"} />,
  );

  expect(container.querySelector("a")?.getAttribute("href")).toBe("https://otomat.dev/doc");
  expect(container.querySelector("a")?.textContent).toContain("the doc");
  expect(container.textContent).not.toContain("[ref]:");
});

it("links an image instead of loading a destination the cockpit cannot authenticate", async () => {
  const container = await render(<Markdown value="![screenshot](https://uploads.test/a.png)" />);

  expect(container.querySelector("img")).toBeNull();
  expect(container.querySelector("a")?.getAttribute("href")).toBe("https://uploads.test/a.png");
  expect(container.querySelector("a")?.textContent).toContain("screenshot");
});

it("keeps a long code block scrollable and copyable", async () => {
  const line = `const path = "${"a/very/long/segment".repeat(12)}";`;
  const container = await render(<Markdown value={`\`\`\`ts\n${line}\n\`\`\``} />);
  const pre = container.querySelector("pre");

  expect(pre?.textContent).toBe(line);
  expect(pre?.className).toContain("overflow-auto");
  expect(pre?.className).toContain("max-h-96");
  expect(
    [...container.querySelectorAll("button")].some(
      (button) => button.getAttribute("aria-label") === "Copy code",
    ),
  ).toBe(true);
});

it("formats an unterminated stream as code and completes it once the fence closes", async () => {
  const partial = await render(<Markdown value={"Result:\n\n```sh\npnpm check"} />);

  expect(partial.querySelector("pre")?.textContent).toBe("pnpm check");
  expect(partial.textContent).toContain("Result:");
  expect(partial.textContent).toContain("streaming");
  expect(partial.textContent).not.toContain("```");

  const complete = await render(<Markdown value={"Result:\n\n```sh\npnpm check\n```"} />);

  expect(complete.querySelector("pre")?.textContent).toBe("pnpm check");
  expect(complete.textContent).not.toContain("streaming");
});

it("keeps the characters of a half-streamed emphasis", async () => {
  const container = await render(<Markdown value="Applying the **fix to the diff" />);

  expect(container.textContent).toBe("Applying the **fix to the diff");
});

it("falls back to the exact text when the content is not Markdown", async () => {
  const container = await render(<Markdown value={"plain line one\nplain line two"} />);

  expect(container.textContent).toBe("plain line one\nplain line two");
  expect(container.querySelector("p")?.className).toContain("whitespace-pre-wrap");
});

it("keeps its own leading when the caller sets a text size", async () => {
  const container = await render(<Markdown value="prose" className="text-sm" />);

  expect(container.firstElementChild?.className).toContain("leading-[1.65]");
  expect(container.firstElementChild?.className).toContain("text-sm");
});

it("renders task markers as checkboxes", async () => {
  const container = await render(<Markdown value={"- [x] shipped\n- [ ] pending"} />);
  const boxes = container.querySelectorAll<HTMLInputElement>('li input[type="checkbox"]');

  expect([...boxes].map((box) => box.checked)).toEqual([true, false]);
  expect([...boxes].every((box) => box.disabled)).toBe(true);
  expect(container.textContent).not.toContain("[x]");
});
