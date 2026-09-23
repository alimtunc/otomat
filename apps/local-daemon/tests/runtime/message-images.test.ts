import { readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, expect, it } from "vitest";

import type { RuntimeImageFile } from "#runtime/contract";
import { runtimeEventSchema } from "#runtime/events";
import { claudeImageCapability } from "#runtime/providers/claude/images";
import { claudeUserFrame } from "#runtime/providers/claude/live-input";
import { CodexRuntimeAdapter } from "#runtime/providers/codex/adapter";
import { codexImageCapability, withoutImagePaths } from "#runtime/providers/codex/images";
import { MemorySink } from "#runtime/sinks";
import { appendLiveInput, createLiveInputChannel } from "#supervisor/live-input";

import { fakePng } from "../support/images.js";
import { runtimeRunInput, runtimeSessionRef } from "../support/runtime.js";
import {
  setupStubHarness,
  STUB_BIN,
  STUB_FIXTURES,
  stubFixture,
  teardownStubHarness,
} from "../support/stub-harness.js";

let worktree: string;

beforeEach(() => {
  worktree = setupStubHarness("otomat-message-images-");
});

afterEach(() => {
  teardownStubHarness(worktree);
});

function storedPng(name: string): RuntimeImageFile {
  const path = join(worktree, name);
  writeFileSync(path, fakePng(24));
  return { path, media_type: "image/png" };
}

it("puts each image in the Claude user frame as a base64 block ahead of the text, and omits an empty text block", () => {
  const image = storedPng("one.png");

  const withText = JSON.parse(claudeUserFrame("what is this", [image]));
  expect(withText.message.content).toEqual([
    {
      type: "image",
      source: {
        type: "base64",
        media_type: "image/png",
        data: readFileSync(image.path).toString("base64"),
      },
    },
    { type: "text", text: "what is this" },
  ]);

  const alone = JSON.parse(claudeUserFrame("", [image]));
  expect(alone.message.content.map((block: { type: string }) => block.type)).toEqual(["image"]);
});

it("refuses to read an image through a symlink", () => {
  const target = storedPng("target.png");
  const link = join(worktree, "link.png");
  symlinkSync(target.path, link);

  expect(() => claudeUserFrame("see", [{ path: link, media_type: "image/png" }])).toThrow(
    /regular file/,
  );
});

it("passes images to Codex as one --image flag each, on exec and after the resume subcommand", async () => {
  const argsFile = join(worktree, "stub-args.json");
  process.env["STUB_FIXTURE"] = join(STUB_FIXTURES, "codex-frames.jsonl");
  process.env["STUB_ARGS_FILE"] = argsFile;
  const adapter = new CodexRuntimeAdapter(STUB_BIN);
  const images = [storedPng("a.png"), storedPng("b.png")];
  const sink = new MemorySink();

  await adapter.run(
    runtimeRunInput({ run_dir: worktree, cwd: worktree, images }),
    sink,
    new AbortController().signal,
  );
  expect(JSON.parse(readFileSync(argsFile, "utf8"))).toEqual([
    "exec",
    "--json",
    "--sandbox",
    "workspace-write",
    "--image",
    images[0]?.path,
    "--image",
    images[1]?.path,
    "-",
  ]);

  await adapter.resume(
    runtimeSessionRef("thread-codex-1"),
    { prompt: "follow up", images, run_dir: worktree, cwd: worktree },
    sink,
    new AbortController().signal,
  );
  expect(JSON.parse(readFileSync(argsFile, "utf8"))).toEqual([
    "exec",
    "--json",
    "--sandbox",
    "workspace-write",
    "resume",
    "--image",
    images[0]?.path,
    "--image",
    images[1]?.path,
    "thread-codex-1",
    "-",
  ]);

  const launchLogs = sink.events
    .map((event) => runtimeEventSchema.parse(event))
    .filter((event) => event.type === "runtime.log")
    .map((event) => JSON.stringify(event.payload))
    .filter((payload) => payload.includes("Arguments sent to Codex"));
  expect(launchLogs).toHaveLength(2);
  for (const payload of launchLogs) {
    expect(payload).not.toContain(worktree);
    expect(payload).toContain('\\"--image\\",\\"[image]\\"');
  }
});

it("replaces only the image paths in an argv", () => {
  expect(withoutImagePaths(["exec", "--image", "/x/a.png", "--model", "gpt", "-"])).toEqual([
    "exec",
    "--image",
    "[image]",
    "--model",
    "gpt",
    "-",
  ]);
});

it("announces Claude images when the installed help announces stream-json input", () => {
  process.env.STUB_FIXTURE = stubFixture("claude-help-current.txt");
  expect(claudeImageCapability(STUB_BIN)).toEqual({ status: "supported", standalone: true });
});

it("refuses Claude images when the installed help announces no stream-json input", () => {
  process.env.STUB_FIXTURE = stubFixture("claude-help-legacy.txt");
  expect(claudeImageCapability(STUB_BIN)).toMatchObject({
    status: "unsupported",
    reason: expect.stringMatching(/stream-json/),
  });
});

it("announces Codex images when exec and exec resume both take the flag", () => {
  process.env.STUB_FIXTURE_BY_ARGV = JSON.stringify({
    "exec --help": stubFixture("codex-exec-help-0.153.4.txt"),
    "exec resume --help": stubFixture("codex-exec-resume-help-0.153.4.txt"),
  });
  expect(codexImageCapability(STUB_BIN)).toEqual({ status: "supported", standalone: false });
});

it("refuses Codex images when only exec takes the flag", () => {
  process.env.STUB_FIXTURE_BY_ARGV = JSON.stringify({
    "exec --help": stubFixture("codex-exec-help-0.153.4.txt"),
    "exec resume --help": stubFixture("codex-exec-resume-help.txt"),
  });
  expect(codexImageCapability(STUB_BIN)).toMatchObject({
    status: "unsupported",
    reason: expect.stringMatching(/codex exec resume/),
  });
});

it("carries a message's images through the live-input channel unchanged", async () => {
  const image = storedPng("live.png");
  appendLiveInput(worktree, { kind: "message", id: "c1", body: "", images: [image] });
  const controller = new AbortController();
  const taken = [];
  for await (const item of createLiveInputChannel(worktree).items(controller.signal)) {
    taken.push(item);
    controller.abort();
  }
  expect(taken).toEqual([{ kind: "message", id: "c1", body: "", images: [image] }]);
});
