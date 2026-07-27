// Runs after the .app is assembled and before it is signed.
const { execFileSync } = require("node:child_process");
const { existsSync, readdirSync, rmSync } = require("node:fs");
const { join } = require("node:path");

// A bundle containing a dangling link fails `codesign --verify --strict`, and electron-builder
// re-creates the deployed daemon's pnpm symlink farm without every link target. Scoped to the daemon
// tree so a dangling link anywhere else still surfaces as a signature failure.
function pruneDanglingLinks(directory) {
  let pruned = 0;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      if (!existsSync(path)) {
        rmSync(path);
        pruned += 1;
      }
      continue;
    }
    if (entry.isDirectory()) pruned += pruneDanglingLinks(path);
  }
  return pruned;
}

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;
  const app = join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);

  const unpacked = join(app, "Contents", "Resources", "app.asar.unpacked");
  if (existsSync(unpacked)) {
    const pruned = pruneDanglingLinks(unpacked);
    if (pruned > 0) console.log(`  • pruned ${pruned} dangling symlink(s) from the bundle`);
  }

  // `identity === null` is the exact predicate electron-builder's own signer uses to skip signing,
  // and only the unsigned build sets it. Ad-hoc signing is not cosmetic: on Apple Silicon an
  // unsigned app cannot load its own Electron Framework. The signed build leaves `identity` unset so
  // electron-builder discovers the Developer ID, and must not be ad-hoc signed first.
  if (context.packager.platformSpecificBuildOptions.identity !== null) return;
  execFileSync("codesign", ["--force", "--deep", "--sign", "-", app], { stdio: "inherit" });
};
