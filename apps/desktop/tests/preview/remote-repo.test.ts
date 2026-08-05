import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  parseSandboxRepoOutput,
  readSandboxTemplate,
  sandboxRepoScript,
} from "#main/preview/remote-repo";

const TEMPLATE_DIR = fileURLToPath(new URL("../../resources/sandbox", import.meta.url));
const HOME_SUFFIX = ".otomat/instances/92584b0";
const DELIMITER = "OTOMAT_SANDBOX_EOF";

describe("readSandboxTemplate", () => {
  it("reads the shipped fixture file by file, nested paths included", () => {
    const files = readSandboxTemplate(TEMPLATE_DIR);

    expect(files.map((file) => file.path).toSorted()).toEqual([
      "README.md",
      "package.json",
      "src/cli.js",
      "src/greeter.js",
      "test/greeter.test.js",
    ]);
    expect(files.every((file) => file.contents.length > 0)).toBe(true);
  });
});

describe("sandboxRepoScript", () => {
  it("writes the fixture inside the instance and commits it with an explicit identity", () => {
    const script = sandboxRepoScript(HOME_SUFFIX, readSandboxTemplate(TEMPLATE_DIR));

    expect(script).toContain('DIR="$HOME/.otomat/instances/92584b0/test-repo"');
    expect(script).toContain('cat > "$DIR/src/cli.js"');
    expect(script).toContain(DELIMITER);
    expect(script).toContain('mkdir -p "$DIR/src"');
    expect(script).toContain("-c 'user.name=Otomat Sandbox'");
    expect(script).toContain("commit.gpgsign=false");
    expect(script).toContain("init -b main");
  });

  it("leaves an already committed repository alone", () => {
    const script = sandboxRepoScript(HOME_SUFFIX, []);

    expect(script).toContain('if [ -d "$DIR/.git" ] && git -C "$DIR" rev-parse --verify HEAD');
    expect(script.indexOf("exit 0")).toBeLessThan(script.indexOf('rm -rf "$DIR"'));
  });

  it("refuses to interpolate a home suffix or a template path it did not validate", () => {
    const files = (path: string, contents = "") => [{ path, contents }];

    expect(() => sandboxRepoScript(".otomat", [])).toThrow(/home suffix/);
    expect(() => sandboxRepoScript('.otomat/instances/x"; rm -rf ~', [])).toThrow(/home suffix/);
    expect(() => sandboxRepoScript(HOME_SUFFIX, files("../escape.js"))).toThrow(/template path/);
    expect(() => sandboxRepoScript(HOME_SUFFIX, files("ok.js", DELIMITER))).toThrow(/heredoc/);
  });
});

describe("parseSandboxRepoOutput", () => {
  it("reads the outcome through login-shell noise", () => {
    const ready = "/home/otomat/.otomat/instances/92584b0/test-repo";

    expect(parseSandboxRepoOutput(`motd\nOTOMAT_SANDBOX:READY:${ready}`)).toEqual({
      kind: "ready",
      path: ready,
    });
    expect(parseSandboxRepoOutput("OTOMAT_SANDBOX:NO_GIT:-")).toEqual({ kind: "git_missing" });
    expect(parseSandboxRepoOutput("OTOMAT_SANDBOX:FAILED:fatal: not a git repository ")).toEqual({
      kind: "failed",
      detail: "fatal: not a git repository",
    });
    expect(parseSandboxRepoOutput("OTOMAT_SANDBOX:READY:relative/path")).toBeNull();
    expect(parseSandboxRepoOutput("nothing reported")).toBeNull();
  });
});
