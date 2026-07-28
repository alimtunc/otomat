import { readFileSync } from "node:fs";
import { join, relative } from "node:path";

import {
  isReexportOnlyBarrel,
  lineCount,
  listFiles,
  readBaseline,
  SOURCE_SCAN_DIRS,
} from "./files.mjs";

const SOURCE_LINE_LIMIT = 250;
const BASELINE_PATH = "scripts/source-size-baseline.json";

export function checkSourceSize(root, report) {
  const baseline = readBaseline(root, BASELINE_PATH);
  const checkedPaths = new Set();

  for (const dir of SOURCE_SCAN_DIRS) {
    for (const file of listFiles(root, dir)) {
      const source = readFileSync(file, "utf8");
      if (isReexportOnlyBarrel(file, source)) continue;
      const lines = lineCount(source);
      const path = relative(root, file);
      checkedPaths.add(path);
      const baselineLines = baseline[path];
      const allowedLines = Math.max(baselineLines ?? 0, SOURCE_LINE_LIMIT);
      if (lines > allowedLines) {
        report(
          file,
          allowedLines + 1,
          1,
          "source-file-size",
          `Runtime source files must stay at or below ${allowedLines} lines; this file has ${lines}. Split it by responsibility.`,
        );
      }
      if (baselineLines !== undefined && lines <= SOURCE_LINE_LIMIT) {
        report(
          file,
          1,
          1,
          "source-size-baseline",
          `This file now fits the ${SOURCE_LINE_LIMIT}-line limit; remove its baseline entry.`,
        );
      } else if (baselineLines !== undefined && lines < baselineLines) {
        report(
          file,
          1,
          1,
          "source-size-baseline",
          `This file shrank to ${lines} lines; lower its baseline from ${baselineLines} to ${lines}.`,
        );
      }
    }
  }

  for (const path of Object.keys(baseline)) {
    if (checkedPaths.has(path)) continue;
    report(
      join(root, path),
      1,
      1,
      "source-size-baseline",
      "This runtime implementation no longer exists. Remove its stale baseline entry.",
    );
  }
}
