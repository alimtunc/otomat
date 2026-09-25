import type { Db } from "@otomat/db";
import type { SchemaMetadataContract } from "@otomat/domain";

import type { RepositoryResolver } from "#git";
import type { GitHubService } from "#github";
import type { LinearService } from "#linear";
import type { ReviewService } from "#review";
import type { Supervisor } from "#supervisor";
import type { TerminalService } from "#terminal";

export interface ApiDeps {
  terminals?: TerminalService;
  db: Db;
  name: string;
  version: string;
  build: string | null;
  startedAt: string;
  dbPath: string;
  token: string;
  schemaMetadata(): SchemaMetadataContract;
  repositories: RepositoryResolver;
  supervisor: Supervisor;
  github: GitHubService;
  linear: LinearService;
  review: ReviewService;
}
