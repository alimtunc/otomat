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
  signal?: AbortSignal;
}

export interface LinearTransportResponse {
  status: number;
  body: unknown;
}

export type LinearTransport = (request: LinearTransportRequest) => Promise<LinearTransportResponse>;

export interface LinearViewer {
  user_name: string;
  workspace_id: string;
  workspace_name: string;
}

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
  project_id: string;
  updated_since: string | null;
}

export interface LinearApiClient {
  viewer(apiKey: string, signal?: AbortSignal): Promise<LinearViewer>;
  workspace(apiKey: string, signal?: AbortSignal): Promise<LinearWorkspaceContract>;
  issues(apiKey: string, query: LinearIssueQuery, signal?: AbortSignal): Promise<LinearIssue[]>;
}

export interface LinearServiceConfig {
  db: Db;
  client: LinearApiClient;
  idFactory?: () => string;
  now?: () => Date;
}

export interface LinearService {
  connection(): LinearConnectionContract;
  connect(apiKey: string): Promise<LinearConnectionContract>;
  disconnect(): LinearConnectionContract;
  workspace(): Promise<LinearWorkspaceContract>;
  sources(): IssueSourceContract[];
  createSource(request: CreateIssueSourceRequest): Promise<IssueSourceContract>;
  sync(sourceId?: string): Promise<IssueSourceSyncResult[]>;
}
