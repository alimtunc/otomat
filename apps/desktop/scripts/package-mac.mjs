// Local development artifact: ad-hoc signed, never distributable, never touches Apple credentials.
// The distributable build is `pnpm desktop:release` (see docs/release/macos-alpha.md).
import { buildMacApp, resolveBuildInfo } from "./mac-build.mjs";

const built = buildMacApp({ buildInfo: resolveBuildInfo({ signed: false }), signing: null });

console.log(`\nUnsigned artifact written to ${built.releaseDir}`);
console.log(`  app: ${built.appPath}`);
console.log(`  dmg: ${built.dmgPath}`);
console.log(
  "\nAd-hoc signed for this machine only. macOS will refuse it on any other Mac, which is the point:\n" +
    "a distributable build must go through the signed release pipeline.",
);
