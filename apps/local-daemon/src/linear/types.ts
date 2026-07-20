import type { Db } from "@otomat/db";
import type {
  CreateIssueSourceRequest,
  IssueSourceContract,
  IssueSourceSyncResult,
  LinearConnectionContract,
  LinearWorkspaceContract,
} from "@otomat/domain";

export interface LinearTransportRequest {
  query: string;
  variables: Record<string, unknown>;
  apiKey: string;
}

/** Header names are lowercased so callers never guess the provider's casing. */
export interface LinearTransportResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

export type LinearTransport = (request: LinearTransportRequest) => Promise<LinearTransportResponse>;

export interface LinearViewer {
  user_name: string;
  workspace_name: string;
  workspace_url_key: string;
}

/** One mirrored Linear issue, already narrowed to the fields Otomat persists. */
export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  url: string;
  updated_at: string;
  state_type: string;
}

export interface LinearIssueQuery {
  team_id: string;
  /** Empty when the whole team is mirrored. */
  project_id: string;
  /** Absolute ISO timestamp watermark; null performs the initial full import. */
  updated_since: string | null;
}

export interface LinearApiClient {
  viewer(apiKey: string): Promise<LinearViewer>;
  workspace(apiKey: string): Promise<LinearWorkspaceContract>;
  issues(apiKey: string, query: LinearIssueQuery): Promise<LinearIssue[]>;
}

/** Process-lifetime credential holder. Nothing here is ever written to disk, logs, or the wire. */
export interface LinearCredentialStore {
  get(): string | null;
  set(apiKey: string): void;
  clear(): void;
}

export interface LinearServiceConfig {
  db: Db;
  client: LinearApiClient;
  credentials?: LinearCredentialStore;
  idFactory?: () => string;
  now?: () => Date;
}

export interface LinearService {
  connection(): LinearConnectionContract;
  connect(apiKey: string): Promise<LinearConnectionContract>;
  disconnect(): LinearConnectionContract;
  workspace(): Promise<LinearWorkspaceContract>;
  sources(): IssueSourceContract[];
  createSource(request: CreateIssueSourceRequest): IssueSourceContract;
  sync(sourceId?: string): Promise<IssueSourceSyncResult[]>;
}
