// @vitest-environment happy-dom
import { DiffMediaPreview } from "@web/components/runs/diff/files/media-preview";
import { expect, it } from "vitest";

import { mount } from "#support/mount";

it("renders before and after media from exact diff bytes", async () => {
  const { container, cleanup } = await mount(
    <DiffMediaPreview
      path="assets/demo.png"
      media={{
        base: {
          kind: "media",
          data: "iVBORw==",
          media_type: "image/png",
        },
        head: {
          kind: "media",
          data: "AAAAIGZ0eXA=",
          media_type: "video/mp4",
        },
      }}
    />,
  );

  const image = container.querySelector("img");
  const video = container.querySelector("video");

  expect(image?.getAttribute("src")).toBe("data:image/png;base64,iVBORw==");
  expect(image?.getAttribute("alt")).toBe("Before assets/demo.png");
  expect(video?.getAttribute("src")).toBe("data:video/mp4;base64,AAAAIGZ0eXA=");
  expect(video?.hasAttribute("controls")).toBe(true);
  expect([...container.querySelectorAll("figcaption")].map((node) => node.textContent)).toEqual([
    "Before",
    "After",
  ]);

  await cleanup();
});
