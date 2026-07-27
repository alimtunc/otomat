// Stops a release that cannot be signed before it costs a build. Prints setup guidance, never a value.
import { existsSync } from "node:fs";
import { join } from "node:path";

import { DESKTOP } from "./mac-build.mjs";
import { readProductVersion } from "./release/metadata.mjs";
import { preflight } from "./release/preflight.mjs";

try {
  preflight({
    env: process.env,
    arch: process.arch,
    version: readProductVersion(join(DESKTOP, "package.json")),
    fileExists: existsSync,
  });
  console.log("Release inputs are complete: credentials, architecture and version all check out.");
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
