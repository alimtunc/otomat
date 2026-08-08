// @vitest-environment happy-dom
import { AgentMessage } from "@web/components/runs/conversation/agent-message";
import { expect, it } from "vitest";

import { envelope } from "#support/envelope";
import { mount } from "#support/mount";

const REPORT = [
  "## Result",
  "",
  "Ran `pnpm check`; see [the run](https://otomat.dev/runs/1).",
  "",
  "- diff reviewed",
  "- PR opened",
].join("\n");

it("renders an agent reply as Markdown and keeps its raw text copyable", async () => {
  const { container, cleanup } = await mount(
    <AgentMessage event={envelope({ type: "runtime.message", source: "claude" })} text={REPORT} />,
  );

  expect(container.querySelector("h2")?.textContent).toBe("Result");
  expect(container.querySelector("code")?.textContent).toBe("pnpm check");
  expect(container.querySelectorAll("li")).toHaveLength(2);
  expect(container.querySelector("a")?.getAttribute("href")).toBe("https://otomat.dev/runs/1");
  expect(container.textContent).not.toContain("## Result");
  expect(
    [...container.querySelectorAll("button")].some(
      (button) => button.getAttribute("aria-label") === "Copy raw text",
    ),
  ).toBe(true);

  await cleanup();
});

it("keeps a partially streamed reply readable", async () => {
  const { container, cleanup } = await mount(
    <AgentMessage
      event={envelope({ type: "runtime.message", source: "claude" })}
      text={"Working on **the diff"}
    />,
  );

  expect(container.textContent).toContain("Working on **the diff");

  await cleanup();
});
