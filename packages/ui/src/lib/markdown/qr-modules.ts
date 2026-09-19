export type QrModules = boolean[][];

const CELLS = new Map<string, [top: boolean, bottom: boolean]>([
  ["█", [true, true]],
  ["▀", [true, false]],
  ["▄", [false, true]],
  [" ", [false, false]],
  ["\u00a0", [false, false]],
]);

const FINDER = ["1111111", "1000001", "1011101", "1011101", "1011101", "1000001", "1111111"].map(
  (row) => [...row].map((bit) => bit === "1"),
);

const isFinder = (grid: QrModules, top: number, left: number): boolean =>
  FINDER.every((row, y) => row.every((dark, x) => grid[top + y]?.[left + x] === dark));

/** `██`-per-module art doubles every column; a finder's `1000001` row never pairs up otherwise. */
const collapseDoubledColumns = (grid: QrModules): QrModules => {
  const doubled =
    grid[0].length % 2 === 0 &&
    grid.every((row) => row.every((dark, x) => x % 2 === 1 || dark === row[x + 1]));
  return doubled ? grid.map((row) => row.filter((_, x) => x % 2 === 0)) : grid;
};

const locateSymbol = (grid: QrModules): QrModules | null => {
  for (const [top, row] of grid.entries()) {
    for (const left of row.keys()) {
      if (!isFinder(grid, top, left)) continue;
      for (let size = 21; size <= 177; size += 4) {
        if (isFinder(grid, top, left + size - 7) && isFinder(grid, top + size - 7, left)) {
          return grid.slice(top, top + size).map((line) => line.slice(left, left + size));
        }
      }
    }
  }
  return null;
};

/** Both polarities are tried: terminal generators paint dark modules as spaces. */
export function parseQrModules(text: string): QrModules | null {
  const lines = text.split(/\r?\n/);
  const width = lines.reduce((widest, line) => Math.max(widest, line.length), 0);
  const halfBlocks = /[▀▄]/.test(text);
  const rows: QrModules = [];
  for (const line of lines) {
    const top: boolean[] = [];
    const bottom: boolean[] = [];
    for (const char of line.padEnd(width)) {
      const cell = CELLS.get(char);
      if (cell === undefined) return null;
      top.push(cell[0]);
      bottom.push(cell[1]);
    }
    rows.push(top);
    if (halfBlocks) rows.push(bottom);
  }
  const grid = collapseDoubledColumns(rows);
  return locateSymbol(grid) ?? locateSymbol(grid.map((row) => row.map((dark) => !dark)));
}
