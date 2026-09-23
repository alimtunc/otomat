// createReexecSpawn re-execs with the test runner's execArgv, which loads no TypeScript: register tsx before booting the daemon entry.
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { register } from "tsx/esm/api";

writeFileSync(process.env.STUB_WORKER_ENV_FILE, JSON.stringify(process.env));
register();
await import(pathToFileURL(process.env.STUB_WORKER_ENTRY).href);
