import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { helpFlagValues } from "#runtime/probe/help-flags";

import { stubFixture } from "../support/stub-harness.js";

const help = (name: string) => readFileSync(stubFixture(name), "utf8");

describe("helpFlagValues", () => {
  it("reads commander's quoted choice list across the lines it wrapped", () => {
    expect(helpFlagValues(help("claude-help-current.txt"), "--permission-mode")).toEqual([
      "acceptEdits",
      "auto",
      "bypassPermissions",
      "manual",
      "dontAsk",
      "plan",
    ]);
  });

  it("reads a bare parenthesised enumeration from a wrapped description", () => {
    expect(helpFlagValues(help("claude-help-current.txt"), "--effort")).toEqual([
      "low",
      "medium",
      "high",
      "xhigh",
      "max",
    ]);
  });

  it("reads an older release's own list, and reports the flags it never documented", () => {
    const legacy = help("claude-help-legacy.txt");
    expect(helpFlagValues(legacy, "--permission-mode")).toEqual([
      "default",
      "acceptEdits",
      "bypassPermissions",
      "plan",
    ]);
    expect(helpFlagValues(legacy, "--effort")).toBeNull();
  });

  it("reads clap's possible-values paragraph, which sits below a blank line", () => {
    const exec = help("codex-exec-help.txt");
    expect(helpFlagValues(exec, "--sandbox")).toEqual([
      "read-only",
      "workspace-write",
      "danger-full-access",
    ]);
    expect(helpFlagValues(exec, "--ask-for-approval")).toEqual([
      "untrusted",
      "on-failure",
      "on-request",
      "never",
    ]);
  });

  it("lets an explicit list win over a bare enumeration earlier in the entry", () => {
    // Synthetic: no shipped CLI mixes the two shapes, but word order must not decide which wins.
    const entry = "Options:\n      --mode <m>  one of (fast, slow) [possible values: a, b]";

    expect(helpFlagValues(entry, "--mode")).toEqual(["a", "b"]);
  });

  it("separates a documented flag with no enumeration from an absent one", () => {
    const exec = help("codex-exec-help.txt");
    expect(helpFlagValues(exec, "--full-auto")).toEqual([]);
    expect(helpFlagValues(exec, "--permission-mode")).toBeNull();
  });

  it("never mistakes a neighbouring flag's list for this flag's", () => {
    const current = help("claude-help-current.txt");
    expect(helpFlagValues(current, "--output-format")).toEqual(["text", "json", "stream-json"]);
    expect(helpFlagValues(current, "--model")).toEqual([]);
  });
});
