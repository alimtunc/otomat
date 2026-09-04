import type { DiffFileContract } from "@otomat/domain";
import { baseName, pathSegments } from "@web/components/runs/diff/files/path";

export type DiffFileType = "implementation" | "tests" | "config" | "docs" | "assets" | "other";

export interface DiffFileGroup {
  type: DiffFileType;
  label: string;
  files: DiffFileContract[];
  additions: number;
  deletions: number;
}

const GROUPS: readonly { type: DiffFileType; label: string }[] = [
  { type: "implementation", label: "Implementation" },
  { type: "tests", label: "Tests" },
  { type: "config", label: "Configuration / tooling" },
  { type: "docs", label: "Documentation" },
  { type: "assets", label: "Assets" },
  { type: "other", label: "Other" },
];

const TEST_FOLDERS = new Set(["test", "tests", "__tests__", "__mocks__", "spec", "specs", "e2e"]);
const TEST_STEM = /(^|[._-])(test|spec)s?([._-]|$)/;
const DOC_FOLDERS = new Set(["doc", "docs"]);
const DOC_EXTENSIONS = new Set(["md", "mdx", "rst", "adoc"]);
const DOC_STEMS = new Set(["readme", "license", "licence", "changelog", "contributing", "authors"]);
const ASSET_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "svg",
  "webp",
  "avif",
  "ico",
  "bmp",
  "icns",
  "woff",
  "woff2",
  "ttf",
  "otf",
  "eot",
  "mp3",
  "mp4",
  "wav",
  "webm",
  "mov",
  "pdf",
]);
const CONFIG_EXTENSIONS = new Set([
  "json",
  "jsonc",
  "json5",
  "yaml",
  "yml",
  "toml",
  "ini",
  "env",
  "cfg",
  "conf",
  "properties",
  "lock",
  "sh",
  "bash",
  "zsh",
  "fish",
  "ps1",
  "bat",
  "mk",
]);
const CONFIG_NAMES = new Set(["dockerfile", "makefile", "procfile", "justfile", "gemfile"]);
const CODE_EXTENSIONS = new Set([
  "ts",
  "tsx",
  "mts",
  "cts",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "vue",
  "svelte",
  "astro",
  "py",
  "rb",
  "go",
  "rs",
  "java",
  "kt",
  "swift",
  "c",
  "h",
  "cc",
  "cpp",
  "hpp",
  "cs",
  "php",
  "scala",
  "ex",
  "exs",
  "dart",
  "lua",
  "sql",
  "graphql",
  "gql",
  "css",
  "scss",
  "sass",
  "less",
  "html",
  "htm",
]);

function extension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot <= 0 ? "" : name.slice(dot + 1).toLowerCase();
}

function stem(name: string): string {
  const dot = name.lastIndexOf(".");
  return (dot <= 0 ? name : name.slice(0, dot)).toLowerCase();
}

export function classifyDiffFile(path: string): DiffFileType {
  const name = baseName(path);
  const base = stem(name);
  const ext = extension(name);
  const folders = pathSegments(path)
    .slice(0, -1)
    .map((folder) => folder.toLowerCase());
  if (DOC_EXTENSIONS.has(ext)) return "docs";
  if (folders.some((folder) => TEST_FOLDERS.has(folder)) || TEST_STEM.test(base)) return "tests";
  if (folders.some((folder) => DOC_FOLDERS.has(folder)) || DOC_STEMS.has(base)) return "docs";
  if (ASSET_EXTENSIONS.has(ext)) return "assets";
  if (
    name.startsWith(".") ||
    folders.some((folder) => folder.startsWith(".")) ||
    CONFIG_EXTENSIONS.has(ext) ||
    CONFIG_NAMES.has(name.toLowerCase()) ||
    base.endsWith(".config")
  ) {
    return "config";
  }
  return CODE_EXTENSIONS.has(ext) ? "implementation" : "other";
}

export function groupDiffFiles(files: readonly DiffFileContract[]): DiffFileGroup[] {
  const buckets = new Map<DiffFileType, DiffFileContract[]>();
  for (const file of files) {
    const type = classifyDiffFile(file.path);
    const bucket = buckets.get(type);
    if (bucket === undefined) buckets.set(type, [file]);
    else bucket.push(file);
  }
  return GROUPS.flatMap(({ type, label }) => {
    const grouped = buckets.get(type);
    if (grouped === undefined) return [];
    return [
      {
        type,
        label,
        files: grouped,
        additions: grouped.reduce((total, file) => total + file.additions, 0),
        deletions: grouped.reduce((total, file) => total + file.deletions, 0),
      },
    ];
  });
}
