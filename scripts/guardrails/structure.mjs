import { readFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";

import { isReexportOnlyBarrel, listFiles, readBaseline, SOURCE_SCAN_DIRS } from "./files.mjs";

const BASELINE_PATH = "scripts/structure-baseline.json";
const ENTRYPOINTS = new Set(["apps/local-daemon/src/index.ts", "apps/desktop/src/main/index.ts"]);
const DOMAIN_PREFIX_MIN = 3;
const DOMAIN_SIBLING_MIN = 3;

function checkBarrels(root, report, allowedBarrels) {
  const impurePaths = new Set();
  for (const dir of SOURCE_SCAN_DIRS) {
    for (const file of listFiles(root, dir)) {
      if (basename(file) !== "index.ts") continue;
      const path = relative(root, file);
      if (ENTRYPOINTS.has(path)) continue;
      if (isReexportOnlyBarrel(file, readFileSync(file, "utf8"))) continue;
      impurePaths.add(path);
      if (!allowedBarrels.has(path)) {
        report(
          file,
          1,
          1,
          "barrel-purity",
          "An index.ts is a barrel: re-export statements only. Move the implementation to a named module and re-export it.",
        );
      }
    }
  }
  for (const path of allowedBarrels) {
    if (impurePaths.has(path)) continue;
    report(
      join(root, path),
      1,
      1,
      "structure-baseline",
      `This barrel is now pure or gone; remove it from ${BASELINE_PATH}.`,
    );
  }
}

function domainClusters(root) {
  const clusters = new Map();
  for (const dir of SOURCE_SCAN_DIRS) {
    for (const file of listFiles(root, dir)) {
      const stem = basename(file).replace(/\.(ts|tsx)$/, "");
      const hyphen = stem.indexOf("-");
      if (hyphen < DOMAIN_PREFIX_MIN) continue;
      const prefix = stem.slice(0, hyphen);
      if (prefix === "use") continue;
      const parent = dirname(file);
      if (basename(parent) === prefix) continue;
      const key = `${relative(root, parent)}#${prefix}`;
      clusters.set(key, (clusters.get(key) ?? []).concat(file));
    }
  }
  return clusters;
}

function checkDomainFolders(root, report, allowedClusters) {
  const activeKeys = new Set();
  for (const [key, files] of domainClusters(root)) {
    if (files.length < DOMAIN_SIBLING_MIN) continue;
    activeKeys.add(key);
    if (allowedClusters.has(key)) continue;
    const prefix = key.split("#").pop();
    report(
      files[0],
      1,
      1,
      "domain-folder",
      `${files.length} sibling files share the \`${prefix}-\` prefix. Group them in a \`${prefix}/\` domain folder.`,
    );
  }
  for (const key of allowedClusters) {
    if (activeKeys.has(key)) continue;
    report(
      join(root, key.split("#")[0]),
      1,
      1,
      "structure-baseline",
      `Cluster \`${key}\` no longer exists; remove it from ${BASELINE_PATH}.`,
    );
  }
}

export function checkStructure(root, report) {
  const baseline = readBaseline(root, BASELINE_PATH);
  checkBarrels(root, report, new Set(baseline.barrels ?? []));
  checkDomainFolders(root, report, new Set(baseline.domainFolders ?? []));
}
