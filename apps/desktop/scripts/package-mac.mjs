// Local development artifact: ad-hoc signed, never distributable, never touches Apple credentials.
// The distributable build is `pnpm desktop:release` (see docs/release/macos-alpha.md).
import { buildMacApp, resolveBuildInfo } from "./mac-build.mjs";
import { readPrNumber, resolveBuildIdentity } from "./release/metadata.mjs";

// `PR_NUMBER` (CI, on a pull request) names the preview after its PR so several previews and the
// stable install coexist on one Mac, sharing no app, no lock and no data.
const identity = resolveBuildIdentity(readPrNumber(process.env));
const built = buildMacApp({
  buildInfo: resolveBuildInfo({ signed: false, pr: identity.pr }),
  signing: null,
  identity,
});

console.log(`\nUnsigned artifact written to ${built.releaseDir}`);
console.log(`  app: ${built.appPath}`);
console.log(`  dmg: ${built.dmgPath}`);
if (identity.pr !== null) {
  console.log(`  identity: ${identity.productName} (${identity.appId})`);
}
console.log(
  "\nAd-hoc signed for this machine only. macOS will refuse it on any other Mac, which is the point:\n" +
    "a distributable build must go through the signed release pipeline.",
);
