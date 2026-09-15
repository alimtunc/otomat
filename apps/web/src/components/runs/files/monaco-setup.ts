import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor/editor/editor.api";
import EditorWorker from "monaco-editor/editor/editor.worker.js?worker";
import "monaco-editor/features/bracketMatching/register.js";
import "monaco-editor/features/clipboard/register.js";
import "monaco-editor/features/codicon/register.js";
import "monaco-editor/features/cursorUndo/register.js";
import "monaco-editor/features/find/register.js";
import "monaco-editor/features/folding/register.js";
import "monaco-editor/features/gotoLine/register.js";
import "monaco-editor/features/indentation/register.js";
import "monaco-editor/features/lineSelection/register.js";
import "monaco-editor/features/linesOperations/register.js";
import "monaco-editor/features/multicursor/register.js";
import "monaco-editor/features/readOnlyMessage/register.js";
import "monaco-editor/features/wordOperations/register.js";
import "monaco-editor/languages/definitions/css/register.js";
import "monaco-editor/languages/definitions/dockerfile/register.js";
import "monaco-editor/languages/definitions/go/register.js";
import "monaco-editor/languages/definitions/html/register.js";
import "monaco-editor/languages/definitions/ini/register.js";
import "monaco-editor/languages/definitions/javascript/register.js";
import "monaco-editor/languages/definitions/markdown/register.js";
import "monaco-editor/languages/definitions/python/register.js";
import "monaco-editor/languages/definitions/rust/register.js";
import "monaco-editor/languages/definitions/scss/register.js";
import "monaco-editor/languages/definitions/shell/register.js";
import "monaco-editor/languages/definitions/sql/register.js";
import "monaco-editor/languages/definitions/typescript/register.js";
import "monaco-editor/languages/definitions/xml/register.js";
import "monaco-editor/languages/definitions/yaml/register.js";

/** Bundled locally and given its own worker: the default loader would fetch Monaco from a CDN, which an offline cockpit never has. */
self.MonacoEnvironment = { getWorker: () => new EditorWorker() };
loader.config({ monaco });

const THEME = { dark: "otomat-dark", light: "otomat-light" } as const;

function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Monaco themes take hex colours, so the palette is read from the tokens at definition time rather than referenced live. */
export function editorTheme(theme: keyof typeof THEME): string {
  monaco.editor.defineTheme(THEME[theme], {
    base: theme === "dark" ? "vs-dark" : "vs",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": token("--surface-1"),
      "editor.foreground": token("--foreground"),
      "editorLineNumber.foreground": token("--text-tertiary"),
      "editorGutter.background": token("--surface-1"),
    },
  });
  return THEME[theme];
}

export const EDITOR_OPTIONS = {
  fontFamily: "JetBrains Mono, ui-monospace, SF Mono, monospace",
  fontSize: 12,
  lineHeight: 19,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  automaticLayout: true,
  renderLineHighlight: "line",
  padding: { top: 8 },
} satisfies monaco.editor.IStandaloneEditorConstructionOptions;
