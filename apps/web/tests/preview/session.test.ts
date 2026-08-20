import { readPreviewManifest } from "@web/preview/manifest";
import { probePreviewDaemon } from "@web/preview/probe";
import { previewSessionState } from "@web/preview/state";
import { describe, expect, it } from "vitest";

const BUILD = "1a2b3c4";

function health(build: string | null) {
  return {
    status: "ok",
    name: "otomat-local-daemon",
    version: "0.1.0",
    build,
    started_at: "2026-08-19T09:30:00.000Z",
    db_path: "/tmp/otomat.db",
    schema: { migration_count: 1, latest_migration_at: 0, page_count: 1, page_size: 4096 },
  };
}

function answering(response: Response): typeof fetch {
  return () => Promise.resolve(response);
}

describe("previewSessionState", () => {
  it("goes live only when the instance serves this build", () => {
    expect(previewSessionState(BUILD, { kind: "ready", build: BUILD })).toEqual({ state: "live" });
  });

  it("blocks on another commit instead of degrading to fixtures", () => {
    expect(previewSessionState(BUILD, { kind: "ready", build: "9f8e7d6" })).toEqual({
      state: "blocked",
      cause: { kind: "build_mismatch", daemonBuild: "9f8e7d6" },
    });
  });

  it("blocks on a daemon that names no build at all", () => {
    expect(previewSessionState(BUILD, { kind: "ready", build: null })).toEqual({
      state: "blocked",
      cause: { kind: "build_mismatch", daemonBuild: null },
    });
  });

  it("separates an unrouted pull request from an instance that is still starting", () => {
    expect(previewSessionState(BUILD, { kind: "unavailable" })).toEqual({
      state: "sandbox",
      reason: "unavailable",
    });
    expect(previewSessionState(BUILD, { kind: "starting" })).toEqual({
      state: "sandbox",
      reason: "starting",
    });
  });

  it("blocks, rather than sandboxes, when the daemon answered something unreadable", () => {
    expect(previewSessionState(BUILD, { kind: "unreadable", detail: "boom" })).toEqual({
      state: "blocked",
      cause: { kind: "unreadable", detail: "boom" },
    });
  });
});

describe("probePreviewDaemon", () => {
  it("reads the build a reachable daemon reports", async () => {
    await expect(probePreviewDaemon(answering(Response.json(health(BUILD))))).resolves.toEqual({
      kind: "ready",
      build: BUILD,
    });
  });

  it.each([
    ["preview_daemon_unavailable", 503],
    ["preview_access_unconfigured", 403],
    ["preview_access_denied", 403],
    ["preview_client_unauthorized", 403],
  ] as const)("recognises the preview plumbing's own refusal %s", async (error, status) => {
    const refusal = Response.json({ error }, { status });
    await expect(probePreviewDaemon(answering(refusal))).resolves.toEqual({ kind: "unavailable" });
  });

  it("treats an unreachable daemon hop as an instance that is still starting", async () => {
    const gateway = Response.json({ error: "preview_daemon_unreachable" }, { status: 502 });
    await expect(probePreviewDaemon(answering(gateway))).resolves.toEqual({ kind: "starting" });
    const starting = Response.json({ error: "preview_daemon_starting" }, { status: 503 });
    await expect(probePreviewDaemon(answering(starting))).resolves.toEqual({ kind: "starting" });
    await expect(probePreviewDaemon(() => Promise.reject(new Error("offline")))).resolves.toEqual({
      kind: "starting",
    });
  });

  it("reports a daemon whose health this build cannot read", async () => {
    const probe = await probePreviewDaemon(answering(Response.json({ status: "nope" })));
    expect(probe.kind).toBe("unreadable");
  });
});

describe("readPreviewManifest", () => {
  it("is null when no manifest sits beside the assets", async () => {
    const missing = answering(new Response(null, { status: 404 }));
    await expect(readPreviewManifest(missing)).resolves.toBeNull();
  });

  it("reads which pull request and commit this deployment serves", async () => {
    const manifest = Response.json({ pull_request: 142, build: BUILD });
    await expect(readPreviewManifest(answering(manifest))).resolves.toEqual({
      pull_request: 142,
      build: BUILD,
    });
  });

  it("refuses a manifest it cannot trust rather than guessing a pull request", async () => {
    const broken = Response.json({ pull_request: "142", build: BUILD });
    await expect(readPreviewManifest(answering(broken))).rejects.toThrow();
    const failed = new Response(null, { status: 500 });
    await expect(readPreviewManifest(answering(failed))).rejects.toThrow();
  });
});
