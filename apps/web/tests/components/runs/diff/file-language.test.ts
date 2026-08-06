import { diffLanguage } from "@web/components/runs/diff/files/language";
import { describe, expect, it } from "vitest";

describe("diff syntax language detection", () => {
  it("maps the languages a review actually reads", () => {
    expect(diffLanguage("apps/web/src/main.tsx")).toBe("tsx");
    expect(diffLanguage("packages/domain/src/index.ts")).toBe("typescript");
    expect(diffLanguage("scripts/guardrails.mjs")).toBe("javascript");
    expect(diffLanguage("package.json")).toBe("json");
    expect(diffLanguage("packages/ui/src/styles/globals.css")).toBe("css");
    expect(diffLanguage("AGENTS.md")).toBe("markdown");
    expect(diffLanguage(".github/workflows/ci.yml")).toBe("yaml");
    expect(diffLanguage("scripts/deploy.sh")).toBe("bash");
  });

  it("reads a multi-part extension by its last segment", () => {
    expect(diffLanguage("packages/db/src/schema.test.ts")).toBe("typescript");
    expect(diffLanguage("apps/web/src/vite-env.d.ts")).toBe("typescript");
  });

  it("resolves extension-less names the project relies on", () => {
    expect(diffLanguage("apps/desktop/Dockerfile")).toBe("dockerfile");
    expect(diffLanguage("Makefile")).toBe("makefile");
  });

  it("ignores case in both the name and the extension", () => {
    expect(diffLanguage("docs/README.MD")).toBe("markdown");
    expect(diffLanguage("build/DOCKERFILE")).toBe("dockerfile");
  });

  it("falls back to plaintext rather than guessing a language", () => {
    expect(diffLanguage("pnpm-lock.yaml")).toBe("yaml");
    expect(diffLanguage("assets/logo.icns")).toBe("plaintext");
    expect(diffLanguage(".gitignore")).toBe("plaintext");
    expect(diffLanguage("LICENSE")).toBe("plaintext");
    expect(diffLanguage("")).toBe("plaintext");
  });

  it("reads each side of a rename independently", () => {
    expect(diffLanguage("src/helper.js")).toBe("javascript");
    expect(diffLanguage("src/helper.ts")).toBe("typescript");
  });
});
