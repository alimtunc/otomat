import type { Db } from "@otomat/db";
import type { SchemaMetadataContract } from "@otomat/domain";

import type { GitHubService } from "#github";
import type { LinearService } from "#linear";
import type { ReviewService } from "#review";
import type { Supervisor } from "#supervisor";

export interface ApiDeps {
  db: Db;
  name: string;
  version: string;
  build: string | null;
  startedAt: string;
  dbPath: string;
  schemaMetadata(): SchemaMetadataContract;
  supervisor: Supervisor;
  github: GitHubService;
  linear: LinearService;
  review: ReviewService;
}
