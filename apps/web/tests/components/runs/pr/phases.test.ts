import { publicationPhases } from "@web/components/runs/pr/phases";
import { describe, expect, it } from "vitest";

const IDLE = {
  generating: false,
  publishing: false,
  generated: false,
  publicationStatus: null,
} as const;

describe("publicationPhases", () => {
  it("shows nothing before a publication starts", () => {
    expect(publicationPhases(IDLE)).toEqual([]);
  });

  it("marks the generation active while the agent writes", () => {
    expect(publicationPhases({ ...IDLE, generating: true })).toMatchObject([
      { key: "generate", state: "active" },
      { key: "push", state: "pending" },
      { key: "create", state: "pending" },
    ]);
  });

  it("follows the daemon's own publication status through push and creation", () => {
    expect(
      publicationPhases({ ...IDLE, generated: true, publicationStatus: "pushing" }),
    ).toMatchObject([
      { key: "generate", state: "done" },
      { key: "push", state: "active" },
      { key: "create", state: "pending" },
    ]);
    expect(
      publicationPhases({ ...IDLE, generated: true, publicationStatus: "creating" }),
    ).toMatchObject([
      { key: "generate", state: "done" },
      { key: "push", state: "done" },
      { key: "create", state: "active" },
    ]);
  });

  it("reports every phase done once the pull request exists", () => {
    expect(
      publicationPhases({ ...IDLE, generated: true, publicationStatus: "created" }),
    ).toMatchObject([
      { key: "generate", state: "done" },
      { key: "push", state: "done" },
      { key: "create", state: "done" },
    ]);
  });

  it("keeps the generated metadata visible after a failed publication", () => {
    expect(
      publicationPhases({ ...IDLE, generated: true, publicationStatus: "failed" }),
    ).toMatchObject([
      { key: "generate", state: "done" },
      { key: "push", state: "pending" },
      { key: "create", state: "pending" },
    ]);
  });
});
