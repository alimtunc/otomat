import type { Db } from "@otomat/db";
import type { RunContract, StartRunRequest } from "@otomat/domain";

export interface ApiDeps {
  db: Db;
  name: string;
  version: string;
  startedAt: string;
  dbPath: string;
  launchRun(request: StartRunRequest): Promise<RunContract>;
}
