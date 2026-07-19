import { delimiter } from "node:path";

import { describe, expect, it } from "vitest";

import { resolveUserPath } from "#shared/user-path";

describe("resolveUserPath", () => {
  it("merges current PATH, login-shell PATH, and fallback dirs, deduped and order-preserving", () => {
    const parts = resolveUserPath({
      platform: "darwin",
      env: { PATH: "/usr/bin:/bin", HOME: "/Users/x", SHELL: "/bin/zsh" },
      readLoginPath: () => "/opt/homebrew/bin:/usr/bin:/Users/x/.nvm/node/bin",
    }).split(delimiter);

    expect(parts).toContain("/usr/bin");
    expect(parts).toContain("/opt/homebrew/bin");
    expect(parts).toContain("/Users/x/.nvm/node/bin");
    expect(parts).toContain("/Users/x/.local/bin");
    expect(parts.filter((dir) => dir === "/usr/bin")).toHaveLength(1);
  });

  it("reads only PATH from the shell (the reader is handed the shell, returns a PATH string)", () => {
    let observedShell = "";
    resolveUserPath({
      platform: "darwin",
      env: { PATH: "/bin", SHELL: "/bin/fish" },
      readLoginPath: (shell) => {
        observedShell = shell;
        return "/extra/bin";
      },
    });
    expect(observedShell).toBe("/bin/fish");
  });

  it("falls back to PATH + known dirs when the login shell cannot be read", () => {
    const parts = resolveUserPath({
      platform: "darwin",
      env: { PATH: "/usr/bin", HOME: "/h" },
      readLoginPath: () => null,
    }).split(delimiter);

    expect(parts).toContain("/usr/bin");
    expect(parts).toContain("/opt/homebrew/bin");
    expect(parts).toContain("/h/.local/bin");
  });

  it("passes PATH through unchanged on Windows", () => {
    expect(resolveUserPath({ platform: "win32", env: { PATH: "C:\\a;C:\\b" } })).toBe(
      "C:\\a;C:\\b",
    );
  });
});
