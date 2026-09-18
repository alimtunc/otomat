import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { LinearError, type LinearFile } from "#linear";
import { stubLinearApiClient } from "#test-support/linear";
import { API_KEY, setupLinearWritebackTest } from "#test-support/linear-writeback";

const UPLOAD = "https://uploads.linear.app/ws/issue/file/demo.mp4";

let test: ReturnType<typeof setupLinearWritebackTest>;

beforeEach(() => {
  test = setupLinearWritebackTest();
});

afterEach(() => test.cleanup());

function file(): LinearFile {
  return { media_type: "video/mp4", size: 3, body: new Blob([new Uint8Array(3)]).stream() };
}

it("lists remote attachments sorted by creation time", async () => {
  test.seedLinearIssue();
  const service = await test.connectedService({
    listAttachments: async () => [
      {
        id: "a2",
        title: "demo.mp4",
        url: UPLOAD,
        created_at: "2026-07-21T11:00:00.000Z",
      },
      {
        id: "a1",
        title: "PR #42",
        url: "https://github.com/acme/repo/pull/42",
        created_at: "2026-07-21T10:00:00.000Z",
      },
    ],
  });

  const attachments = await service.writeback.attachments("li");
  expect(attachments.map((attachment) => attachment.id)).toEqual(["a1", "a2"]);
});

it("downloads media under the issue's own connection key", async () => {
  test.seedLinearIssue();
  const downloadFile = vi.fn(async () => file());
  const service = await test.connectedService({ downloadFile });

  const media = await service.writeback.media("li", UPLOAD);

  expect(media.media_type).toBe("video/mp4");
  expect(downloadFile).toHaveBeenCalledWith(API_KEY, UPLOAD, expect.any(AbortSignal));
});

it("refuses media for an issue whose workspace is not connected", async () => {
  test.seedLinearIssue();
  const downloadFile = vi.fn(async () => file());
  const service = test.createService(stubLinearApiClient({ downloadFile }));

  await expect(service.writeback.media("li", UPLOAD)).rejects.toMatchObject({
    code: "linear_not_connected",
  });
  expect(downloadFile).not.toHaveBeenCalled();
});

it("refuses media for an issue that is not mirrored from Linear", async () => {
  const downloadFile = vi.fn(async () => file());
  const service = await test.connectedService({ downloadFile });

  await expect(service.writeback.media("missing", UPLOAD)).rejects.toBeInstanceOf(LinearError);
  expect(downloadFile).not.toHaveBeenCalled();
});
