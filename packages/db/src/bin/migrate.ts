import { defaultDbPath, runMigrations } from "../migrate.js";

const dbPath = defaultDbPath();
runMigrations(dbPath);
console.log(`[otomat] migrations applied: ${dbPath}`);
