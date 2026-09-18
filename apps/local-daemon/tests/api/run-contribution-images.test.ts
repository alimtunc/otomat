import type { RunContributionContract } from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { RunContributionImageError } from "#supervisor";

import {
  contributionRow,
  json,
  makeApiApp,
  post,
  request,
  stubSupervisor,
} from "../support/api.js";
import { setupTestDb, type TestDb } from "../support/db.js";
import { fakePng } from "../support/images.js";
import { seedRun } from "../support/seed.js";

let t: TestDb;

beforeEach(() => {
  t = setupTestDb("otomat-contribution-images-");
});

afterEach(() => {
  t.cleanup();
});

const RUN = "run-images";
const REQUEST = {
  step_run_id: "step-1",
  target_agent_session_id: "session-1",
  target_config_hash: "config-1",
};

function seed(): void {
  seedRun(t.db, {
    runId: RUN,
    runStatus: "awaiting_human",
    stepStatus: "awaiting_human",
    sessionStatus: "awaiting_input",
  });
}

function multipart(body: string, images: Uint8Array<ArrayBuffer>[]): FormData {
  const form = new FormData();
  form.set("request", JSON.stringify({ ...REQUEST, body }));
  for (const bytes of images) {
    form.append("images", new File([bytes], "ignored-client-name.png", { type: "image/png" }));
  }
  return form;
}

function postForm(app: ReturnType<typeof makeApiApp>, form: FormData): Promise<Response> {
  return request(app, `/api/runs/${RUN}/contributions`, { method: "POST", body: form });
}

it("hands the multipart images to the supervisor as bytes and answers the persisted images", async () => {
  seed();
  let received: { body: string; uploads: number[] } | null = null;
  const app = makeApiApp(t, {
    supervisor: stubSupervisor({
      contribute: async (_id, stepRunId, _session, _hash, body, uploads) => {
        received = { body, uploads: uploads.map((upload) => upload.byteLength) };
        return contributionRow(RUN, {
          step_run_id: stepRunId,
          body,
          images_json: [{ id: "img-1", media_type: "image/png", size_bytes: 64 }],
        });
      },
    }),
  });

  const res = await postForm(app, multipart("  what is this  ", [fakePng(64), fakePng(32)]));

  expect(res.status).toBe(201);
  expect(received).toEqual({ body: "what is this", uploads: [64, 32] });
  const contribution = await json<RunContributionContract>(res);
  expect(contribution.images).toEqual([{ id: "img-1", media_type: "image/png", size_bytes: 64 }]);
});

it("refuses an empty message unless an image carries it", async () => {
  seed();
  const app = makeApiApp(t, {
    supervisor: stubSupervisor({
      contribute: async (_id, stepRunId, _session, _hash, body) =>
        contributionRow(RUN, { step_run_id: stepRunId, body }),
    }),
  });

  const blankJson = await post(app, `/api/runs/${RUN}/contributions`, { ...REQUEST, body: " " });
  expect(blankJson.status).toBe(400);
  expect((await json<{ error: string }>(blankJson)).error).toBe("invalid_request");

  const blankForm = await postForm(app, multipart("", []));
  expect(blankForm.status).toBe(400);

  const imageOnly = await postForm(app, multipart("", [fakePng()]));
  expect(imageOnly.status).toBe(201);
});

it("maps an image refusal to its own status: 400 for a bad upload, 409 for a runtime without images", async () => {
  seed();
  const errors = [
    new RunContributionImageError(
      "image_invalid",
      "Image 1 is not a PNG, JPEG, GIF or WebP image.",
    ),
    new RunContributionImageError(
      "images_unsupported",
      "This Codex CLI does not announce an image flag.",
    ),
  ];
  const app = makeApiApp(t, {
    supervisor: stubSupervisor({
      contribute: async () => {
        const error = errors.shift();
        if (error === undefined) throw new Error("no refusal left");
        throw error;
      },
    }),
  });

  const invalid = await postForm(app, multipart("see", [fakePng()]));
  expect(invalid.status).toBe(400);
  expect(await json(invalid)).toEqual({
    error: "run_contribution_image_invalid",
    message: "Image 1 is not a PNG, JPEG, GIF or WebP image.",
  });

  const unsupported = await postForm(app, multipart("see", [fakePng()]));
  expect(unsupported.status).toBe(409);
  expect(await json(unsupported)).toEqual({
    error: "run_contribution_images_unsupported",
    message: "This Codex CLI does not announce an image flag.",
  });
});

it("serves a message's image bytes under its own content type, and 404 for an unknown one", async () => {
  seed();
  const bytes = fakePng(48);
  const app = makeApiApp(t, {
    supervisor: stubSupervisor({
      contributionImage: (runId, contributionId, imageId) =>
        runId === RUN && contributionId === "c1" && imageId === "img-1"
          ? { media_type: "image/png", bytes: Buffer.from(bytes) }
          : null,
    }),
  });

  const res = await request(app, `/api/runs/${RUN}/contributions/c1/images/img-1`);
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toBe("image/png");
  expect(res.headers.get("cache-control")).toContain("immutable");
  expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes);

  const missing = await request(app, `/api/runs/${RUN}/contributions/c1/images/img-2`);
  expect(missing.status).toBe(404);
  expect((await json<{ error: string }>(missing)).error).toBe("run_contribution_image_not_found");
});
