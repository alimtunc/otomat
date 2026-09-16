import type { CSSProperties } from "react";

/** Row indentation, shared so a folder row and the files under it align on the same grid. */
const ROW_PADDING_REM = 0.75;
const INDENT_REM = 0.75;

export function rowIndent(depth: number): CSSProperties {
  return { paddingLeft: `${ROW_PADDING_REM + depth * INDENT_REM}rem` };
}
