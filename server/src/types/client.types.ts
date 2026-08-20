import { ApiPermission } from './permissions.types.js';

export type ApiClientStatus = 'active' | 'disabled' | 'revoked';

export interface ApiClient {
  id: string;
  tenant_id: string;
  name: string;
  client_id: string;
  client_secret_hash: string;
  status: ApiClientStatus;
  permissions: ApiPermission[];
  allowed_branch_ids: string[];
  allowed_origins: string[];
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
  expires_at: string | null;
}

export interface CreateApiClientInput {
  tenant_id: string;
  name: string;
  permissions: ApiPermission[];
  allowed_branch_ids?: string[];
  allowed_origins?: string[];
  expires_in_days?: number;
  expires_at?: string | null;
}

export interface CreateApiClientResult {
  client: Omit<ApiClient, 'client_secret_hash'>;
  client_secret: string;
  credential_header: string; // Ready-to-use Bearer token string
}
