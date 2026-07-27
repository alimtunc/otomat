// Runs after the .app is assembled and before it is signed.
const { execFileSync } = require("node:child_process");
const { existsSync, lstatSync, readdirSync, rmSync } = require("node:fs");
const { join } = require("node:path");

// electron-builder re-creates the deployed daemon's pnpm symlink farm inside app.asar.unpacked but
// does not copy every link target. The survivors dangle, and a bundle containing a dangling link
// fails `codesign --verify --strict` — so it would ship unverifiable. Every daemon dependency also
// resolves from the flat top-level node_modules, which is what the daemon actually loads.
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
    if (lstatSync(path).isDirectory()) pruned += pruneDanglingLinks(path);
  }
  return pruned;
}

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;
  const app = join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);

  const pruned = pruneDanglingLinks(app);
  if (pruned > 0) console.log(`  • pruned ${pruned} dangling symlink(s) from the bundle`);

  // Only the unsigned build sets `identity: null`. Ad-hoc signing it is not cosmetic: on Apple
  // Silicon an unsigned app cannot load its own Electron Framework (dyld refuses).
  if (context.packager.config.mac.identity !== null) return;
  execFileSync("codesign", ["--force", "--deep", "--sign", "-", app], { stdio: "inherit" });
};
