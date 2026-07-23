import { prepareDatabase } from "../data-safety/prepare.js";
import { defaultDbPath } from "../migrate.js";

const dbPath = defaultDbPath();
await prepareDatabase(dbPath);
console.log(`[otomat] migrations applied: ${dbPath}`);
