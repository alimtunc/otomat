import { upsertProject, type Db } from "@otomat/db";

export const DEFAULT_PROJECT_ID = "local-default";

export function ensureDefaultProject(db: Db, rootPath: string): string {
  upsertProject(db, { id: DEFAULT_PROJECT_ID, name: "Local workspace", root_path: rootPath });
  return DEFAULT_PROJECT_ID;
}
