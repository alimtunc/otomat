import { existsSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { listRunContributions } from "@otomat/db";
import { CONTRIBUTION_IMAGE_LIMITS } from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { runDir, sessionDir } from "#events";
import { clearProviderProbeCache } from "#runtime";
import { RunContributionImageError } from "#supervisor";

import { contributeToStep } from "../support/contribution.js";
import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { fakePng } from "../support/images.js";
import { waitFor } from "../support/poll.js";
import { stubRuntimeOnPath } from "../support/runtime.js";
import { firstStepOf, seedWorkflowRun } from "../support/seed.js";
import { stubFixture } from "../support/stub-harness.js";
import { makeSupervisor } from "../support/supervisor.js";

let fix: DaemonTestDb;
let restorePath: (() => void) | null = null;

beforeEach(() => {
  fix = setupDaemonDb();
});

afterEach(() => {
  restorePath?.();
  restorePath = null;
  clearProviderProbeCache();
  fix.cleanup();
});

function imagesDir(runId: string): string {
  return join(runDir(fix.dataDir, runId), "images");
}

async function refusal(work: Promise<unknown>): Promise<RunContributionImageError> {
  try {
    await work;
  } catch (error) {
    if (error instanceof RunContributionImageError) return error;
    throw error;
  }
  throw new Error("expected the contribution to be refused");
}

it("stores the images with the message, survives a restart and hands them to the next turn in order", async () => {
  const first = makeSupervisor(fix, ["slow", "complete"]);
  const run = await first.supervisor.start({ prompt: "do the work" });
  await waitFor(() => first.spawn.calls === 1);
  const step = firstStepOf(fix.db, run.id);

  const queued = await contributeToStep(fix.db, first.supervisor, run.id, step, "look at these", [
    fakePng(64),
    fakePng(96),
  ]);

  expect(queued.images_json).toHaveLength(2);
  expect(queued.images_json.map((image) => image.media_type)).toEqual(["image/png", "image/png"]);
  expect(queued.images_json.map((image) => image.size_bytes)).toEqual([64, 96]);
  const stored = readdirSync(imagesDir(run.id)).toSorted();
  expect(stored).toEqual(queued.images_json.map((image) => `${image.id}.png`).toSorted());

  await first.supervisor.settle();
  const delivery = first.spawn.jobs[1];
  expect(delivery?.mode).toBe("resume");
  expect(delivery?.prompt).toBe("look at these");
  expect(delivery?.images.map((image) => image.media_type)).toEqual(["image/png", "image/png"]);
  expect(delivery?.images.map((image) => image.path)).toEqual(
    queued.images_json.map((image) => join(imagesDir(run.id), `${image.id}.png`)),
  );
  expect(listRunContributions(fix.db, run.id)[0]?.status).toBe("acknowledged");

  const restarted = makeSupervisor(fix, "complete");
  await restarted.supervisor.reconcile();
  const rows = listRunContributions(fix.db, run.id);
  expect(rows).toHaveLength(1);
  expect(rows[0]?.images_json).toEqual(queued.images_json);
  expect(readdirSync(imagesDir(run.id))).toHaveLength(2);
});

it("accepts an image without text when the runtime can take one alone", async () => {
  const { supervisor } = makeSupervisor(fix, "linger");
  const run = await supervisor.start({ prompt: "do the work" });

  const queued = await contributeToStep(
    fix.db,
    supervisor,
    run.id,
    firstStepOf(fix.db, run.id),
    "",
    [fakePng()],
  );

  expect(queued.body).toBe("");
  expect(queued.images_json).toHaveLength(1);
  await supervisor.abort(run.id);
  await supervisor.settle();
});

it("refuses bytes that are not an image, an oversized image and too many images before writing anything", async () => {
  const { supervisor } = makeSupervisor(fix, "linger");
  const { id: runId } = await supervisor.start({ prompt: "do the work" });
  const step = firstStepOf(fix.db, runId);
  const contribute = (uploads: Uint8Array[]) =>
    contributeToStep(fix.db, supervisor, runId, step, "see", uploads);

  const notImage = await refusal(contribute([new TextEncoder().encode("<svg onload=alert(1)>")]));
  expect(notImage.code).toBe("image_invalid");
  expect(notImage.message).toMatch(/not a PNG, JPEG, GIF or WebP/);

  const oversized = await refusal(contribute([fakePng(CONTRIBUTION_IMAGE_LIMITS.max_bytes + 1)]));
  expect(oversized.code).toBe("image_invalid");
  expect(oversized.message).toMatch(/larger than 5 MB/);

  const tooMany = await refusal(
    contribute(Array.from({ length: CONTRIBUTION_IMAGE_LIMITS.max_count + 1 }, () => fakePng())),
  );
  expect(tooMany.code).toBe("image_invalid");
  expect(tooMany.message).toMatch(/at most 4 images/);

  expect(existsSync(imagesDir(runId))).toBe(false);
  expect(listRunContributions(fix.db, runId)).toEqual([]);
  await supervisor.abort(runId);
  await supervisor.settle();
});

it("refuses an image for a runtime whose installed CLI announces no image channel", async () => {
  restorePath = stubRuntimeOnPath(fix.dataDir, "codex");
  const { supervisor } = makeSupervisor(fix, "linger");
  const run = await supervisor.start({ prompt: "do the work", runtime: "codex" });
  const step = firstStepOf(fix.db, run.id);

  const refused = await refusal(
    contributeToStep(fix.db, supervisor, run.id, step, "see", [fakePng()]),
  );

  expect(refused.code).toBe("images_unsupported");
  expect(refused.message).toMatch(/does not announce an image flag/);
  expect(existsSync(imagesDir(run.id))).toBe(false);
  await supervisor.abort(run.id);
  await supervisor.settle();
});

it("refuses an image without text for a runtime that needs the prompt on stdin", async () => {
  restorePath = stubRuntimeOnPath(fix.dataDir, "codex", stubFixture("codex-exec-help-0.153.4.txt"));
  const { supervisor } = makeSupervisor(fix, "linger");
  const run = await supervisor.start({ prompt: "do the work", runtime: "codex" });
  const step = firstStepOf(fix.db, run.id);

  const refused = await refusal(
    contributeToStep(fix.db, supervisor, run.id, step, "", [fakePng()]),
  );
  expect(refused.code).toBe("images_unsupported");
  expect(refused.message).toMatch(/text message next to an image/);

  const accepted = await contributeToStep(fix.db, supervisor, run.id, step, "see", [fakePng()]);
  expect(accepted.images_json).toHaveLength(1);
  await supervisor.abort(run.id);
  await supervisor.settle();
});

it("writes the image files into a live Claude session's inbox item", async () => {
  restorePath = stubRuntimeOnPath(fix.dataDir, "claude", stubFixture("claude-help-current.txt"));
  const { supervisor, spawn } = makeSupervisor(fix, "live");
  const runId = "r-live-images";
  const seeded = seedWorkflowRun(fix.db, {
    runId,
    runStatus: "awaiting_human",
    steps: [
      {
        id: "s-live-images",
        agent: "claude",
        status: "awaiting_human",
        session: { status: "awaiting_input", providerSessionId: "ps-claude" },
      },
    ],
  })("s-live-images");
  await supervisor.resume(runId);

  const delivered = await contributeToStep(fix.db, supervisor, runId, seeded.stepRunId, "", [
    fakePng(),
  ]);

  expect(delivered.status).toBe("delivered");
  const activeSessionId = spawn.jobs[0]?.agentSessionId;
  if (!activeSessionId) throw new Error("expected the active session id");
  const inbox = readFileSync(
    join(sessionDir(fix.dataDir, runId, activeSessionId), "live-input.jsonl"),
    "utf8",
  );
  const item = JSON.parse(inbox.trim());
  expect(item.body).toBe("");
  expect(item.images).toEqual([
    {
      path: join(imagesDir(runId), `${delivered.images_json[0]?.id}.png`),
      media_type: "image/png",
    },
  ]);
  await supervisor.abort(runId);
  await supervisor.settle();
});

it("serves a stored image back and refuses one replaced by a symlink", async () => {
  const { supervisor } = makeSupervisor(fix, "linger");
  const run = await supervisor.start({ prompt: "do the work" });
  const step = firstStepOf(fix.db, run.id);
  const bytes = fakePng(40);
  const queued = await contributeToStep(fix.db, supervisor, run.id, step, "see", [bytes]);
  const image = queued.images_json[0];
  if (!image) throw new Error("expected one image");

  const served = supervisor.contributionImage(run.id, queued.id, image.id);
  expect(served?.media_type).toBe("image/png");
  expect(served?.bytes.equals(Buffer.from(bytes))).toBe(true);
  expect(supervisor.contributionImage(run.id, queued.id, "nope")).toBeNull();
  expect(supervisor.contributionImage("other-run", queued.id, image.id)).toBeNull();

  const path = join(imagesDir(run.id), `${image.id}.png`);
  const secret = join(fix.dataDir, "secret.png");
  writeFileSync(secret, fakePng(8));
  rmSync(path);
  symlinkSync(secret, path);
  expect(() => supervisor.contributionImage(run.id, queued.id, image.id)).toThrow(/regular file/);

  await supervisor.abort(run.id);
  await supervisor.settle();
});
