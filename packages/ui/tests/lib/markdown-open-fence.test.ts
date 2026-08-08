import { expect, it } from "vitest";

import { openFenceBody } from "#ui/lib/markdown/open-fence";

it("reports no open fence for a closed document", () => {
  expect(openFenceBody("text\n\n```ts\nconst a = 1;\n```\n\nmore")).toBeNull();
});

it("returns the body of a fence the stream has not closed", () => {
  expect(openFenceBody("Result:\n\n```sh\npnpm check")).toBe("pnpm check");
});

it("only counts a closer that matches the marker it opened with", () => {
  expect(openFenceBody("~~~ts\nconst a = 1;\n```")).toBe("const a = 1;\n```");
  expect(openFenceBody("````ts\n```\nstill inside")).toBe("```\nstill inside");
});

it("tracks the last fence when several blocks precede it", () => {
  expect(openFenceBody("```js\na\n```\n\ntext\n\n```sh\nb")).toBe("b");
});
