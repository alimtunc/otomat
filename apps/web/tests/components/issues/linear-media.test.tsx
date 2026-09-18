// @vitest-environment happy-dom
import { DaemonRequestError } from "@otomat/client";
import { Markdown } from "@otomat/ui";
import {
  LinearAttachmentsSection,
  LinearMediaProvider,
} from "@web/components/issues/workspace/linear/media";
import { act, type ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { findButton } from "#support/dom-queries";
import { mount, type Mounted } from "#support/mount";
import { withQueryClient } from "#support/query";

const getLinearMedia = vi.fn();
const getLinearAttachments = vi.fn();

vi.mock("@web/api/client", () => ({
  daemon: {
    getLinearMedia: (issueId: string, url: string) => getLinearMedia(issueId, url),
    getLinearAttachments: (issueId: string) => getLinearAttachments(issueId),
  },
}));

const IMAGE = "https://uploads.linear.app/ws/issue/file/screen.png";
const VIDEO = "https://uploads.linear.app/ws/issue/file/demo.mp4";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

let rendered: Mounted | null = null;

function linearIssue(node: ReactNode): ReactNode {
  return withQueryClient(<LinearMediaProvider issueId="li">{node}</LinearMediaProvider>);
}

function refusal(status: number, error: string, message: string): DaemonRequestError {
  return new DaemonRequestError(status, "GET", "/api/linear/issues/li/media", { error, message });
}

afterEach(async () => {
  await rendered?.cleanup();
  rendered = null;
  vi.clearAllMocks();
  document.body.replaceChildren();
});

it("renders a Linear upload image through the daemon and enlarges it on demand", async () => {
  getLinearMedia.mockResolvedValue(new Blob([PNG], { type: "image/png" }));

  rendered = await mount(linearIssue(<Markdown value={`![Screenshot](${IMAGE})`} allowMedia />));

  await vi.waitFor(() => {
    expect(rendered?.container.querySelector("img")).not.toBeNull();
  });
  const image = rendered.container.querySelector("img");
  expect(getLinearMedia).toHaveBeenCalledWith("li", IMAGE);
  expect(image?.getAttribute("src")).toMatch(/^data:image\/png;base64,/);
  expect(image?.getAttribute("alt")).toBe("Screenshot");
  expect(rendered.container.textContent).toContain("Screenshot · screen.png · image/png · 4 bytes");
  expect(rendered.container.querySelector("a")?.getAttribute("href")).toBe(IMAGE);

  const enlarge = rendered.container.querySelector<HTMLButtonElement>(
    'button[aria-label="Enlarge Screenshot"]',
  );
  expect(enlarge).not.toBeNull();
  await act(async () => enlarge?.click());
  await vi.waitFor(() => {
    expect(document.body.querySelectorAll("img")).toHaveLength(2);
  });
  expect(document.body.querySelector("[role='dialog']")).not.toBeNull();
});

it("plays a Linear upload video with native controls and no autoplay", async () => {
  getLinearMedia.mockResolvedValue(new Blob([PNG], { type: "video/mp4" }));

  rendered = await mount(linearIssue(<Markdown value={`[Demo](${VIDEO})`} allowMedia />));

  await vi.waitFor(() => {
    expect(rendered?.container.querySelector("video")).not.toBeNull();
  });
  const video = rendered.container.querySelector("video");
  expect(video?.getAttribute("src")).toMatch(/^data:video\/mp4;base64,/);
  expect(video?.hasAttribute("controls")).toBe(true);
  expect(video?.hasAttribute("autoplay")).toBe(false);
  expect(video?.getAttribute("preload")).toBe("metadata");
  expect(rendered.container.textContent).toContain("Demo · demo.mp4 · video/mp4");
});

it("offers to retry or open in Linear when a file is gone or refused", async () => {
  getLinearMedia
    .mockRejectedValueOnce(
      refusal(404, "linear_media_expired", "This file is no longer available on Linear."),
    )
    .mockRejectedValueOnce(
      refusal(400, "linear_media_refused", "This file can’t be displayed inline."),
    );

  rendered = await mount(linearIssue(<Markdown value={`![Screenshot](${IMAGE})`} allowMedia />));

  await vi.waitFor(() => {
    expect(rendered?.container.textContent).toContain(
      "This file is no longer available on Linear.",
    );
  });
  expect(rendered.container.querySelector("img")).toBeNull();
  const open = rendered.container.querySelector("a");
  expect(open?.textContent).toContain("Open in Linear");
  expect(open?.getAttribute("href")).toBe(IMAGE);
  expect(open?.getAttribute("target")).toBe("_blank");

  await act(async () => findButton("Retry")?.click());
  await vi.waitFor(() => {
    expect(rendered?.container.textContent).toContain("This file can’t be displayed inline.");
  });
  expect(getLinearMedia).toHaveBeenCalledTimes(2);
});

it("keeps loading media from other hosts directly", async () => {
  rendered = await mount(
    linearIssue(<Markdown value="![Public](https://cdn.example.com/a.png)" allowMedia />),
  );

  expect(rendered.container.querySelector("img")?.getAttribute("src")).toBe(
    "https://cdn.example.com/a.png",
  );
  expect(getLinearMedia).not.toHaveBeenCalled();
});

it("lists media attachments and leaves link attachments out", async () => {
  getLinearAttachments.mockResolvedValue([
    {
      id: "a1",
      title: "PR #42",
      url: "https://github.com/acme/repo/pull/42",
      created_at: "2026-07-21T10:00:00.000Z",
    },
    {
      id: "a2",
      title: "Recording",
      url: VIDEO,
      created_at: "2026-07-21T11:00:00.000Z",
    },
  ]);
  getLinearMedia.mockResolvedValue(new Blob([PNG], { type: "video/mp4" }));

  rendered = await mount(linearIssue(<LinearAttachmentsSection issueId="li" />));

  await vi.waitFor(() => {
    expect(rendered?.container.querySelector("video")).not.toBeNull();
  });
  expect(rendered.container.textContent).toContain("Attachments · 1");
  expect(rendered.container.textContent).not.toContain("PR #42");
  expect(getLinearMedia).toHaveBeenCalledWith("li", VIDEO);
});
