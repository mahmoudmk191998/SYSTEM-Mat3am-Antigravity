import { getFirestoreDb } from '../config/firebase.js';
import { ApiClient, ApiClientStatus, CreateApiClientInput, CreateApiClientResult } from '../types/client.types.js';
import { ApiPermission } from '../types/permissions.types.js';
import {
  generateClientId,
  generateClientSecret,
  createCredentialString,
  hashSecret,
  verifySecret,
} from '../utils/crypto.js';
import { NotFoundError, UnauthorizedError, ValidationError } from '../utils/errors.js';

import { env } from '../config/environment.js';

const COLLECTION_NAME = 'api_clients';

// In-memory store fallback for testing or mock environments
const inMemoryClients = new Map<string, ApiClient>();

export class ApiClientService {
  private useMemory: boolean;

  constructor(useMemory: boolean = env.NODE_ENV === 'test') {
    this.useMemory = useMemory;
  }

  /**
   * Creates a new API client credential for a tenant restaurant.
   * Client secret is generated, hashed, and returned ONCE in plain text.
   */
  async createClient(input: CreateApiClientInput): Promise<CreateApiClientResult> {
    if (!input.tenant_id) {
      throw new ValidationError('tenant_id is required');
    }
    if (!input.name) {
      throw new ValidationError('Client name is required');
    }
    if (!input.permissions || !Array.isArray(input.permissions)) {
      throw new ValidationError('permissions array is required');
    }

    const clientId = generateClientId();
    const rawSecret = generateClientSecret();
    const secretHash = await hashSecret(rawSecret);
    const now = new Date().toISOString();

    let expiresAt: string | null = null;
    if (input.expires_at !== undefined) {
      expiresAt = input.expires_at;
    } else if (input.expires_in_days !== undefined) {
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + input.expires_in_days);
      expiresAt = expDate.toISOString();
    }

    const clientData: ApiClient = {
      id: clientId,
      tenant_id: input.tenant_id,
      name: input.name,
      client_id: clientId,
      client_secret_hash: secretHash,
      status: 'active',
      permissions: input.permissions,
      allowed_branch_ids: input.allowed_branch_ids || [],
      allowed_origins: input.allowed_origins || [],
      created_at: now,
      updated_at: now,
      last_used_at: null,
      expires_at: expiresAt,
    };

    if (this.useMemory) {
      inMemoryClients.set(clientId, clientData);
    } else {
      try {
        const db = getFirestoreDb();
        await db.collection(COLLECTION_NAME).doc(clientId).set(clientData);
      } catch (err) {
        // Fallback to in-memory if DB is unreachable in test mode
        inMemoryClients.set(clientId, clientData);
      }
    }

    const { client_secret_hash, ...safeClient } = clientData;
    const credentialHeader = createCredentialString(clientId, rawSecret);

    return {
      client: safeClient,
      client_secret: rawSecret,
      credential_header: credentialHeader,
    };
  }

  /**
   * Retrieves an API Client by its public client_id
   */
  async getClientByClientId(clientId: string): Promise<ApiClient | null> {
    if (this.useMemory || inMemoryClients.has(clientId)) {
      return inMemoryClients.get(clientId) || null;
    }

    try {
      const db = getFirestoreDb();
      const doc = await db.collection(COLLECTION_NAME).doc(clientId).get();
      if (!doc.exists) {
        return inMemoryClients.get(clientId) || null;
      }
      return doc.data() as ApiClient;
    } catch (err) {
      return inMemoryClients.get(clientId) || null;
    }
  }

  /**
   * Verifies credentials sent by external restaurant clients.
   * Performs status check, expiration check, and hash matching.
   */
  async verifyCredentials(clientId: string, rawSecret: string): Promise<ApiClient> {
    const client = await this.getClientByClientId(clientId);
    if (!client) {
      throw new UnauthorizedError('Invalid client credentials');
    }

    if (client.status === 'revoked') {
      throw new UnauthorizedError('This API credential has been revoked');
    }

    if (client.status === 'disabled') {
      throw new UnauthorizedError('This API credential is currently disabled');
    }

    if (client.expires_at && new Date(client.expires_at) < new Date()) {
      throw new UnauthorizedError('This API credential has expired');
    }

    const isMatch = await verifySecret(rawSecret, client.client_secret_hash);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid client credentials');
    }

    // Update last_used_at asynchronously
    this.updateLastUsed(clientId).catch(() => {});

    return client;
  }

  /**
   * Updates last_used_at timestamp
   */
  async updateLastUsed(clientId: string): Promise<void> {
    const now = new Date().toISOString();
    const inMem = inMemoryClients.get(clientId);
    if (inMem) {
      inMem.last_used_at = now;
    }

    if (!this.useMemory) {
      try {
        const db = getFirestoreDb();
        await db.collection(COLLECTION_NAME).doc(clientId).update({
          last_used_at: now,
        });
      } catch (_) {}
    }
  }

  /**
   * Rotates client secret and returns new secret ONCE.
   */
  async rotateSecret(clientId: string): Promise<{ newSecret: string; credential_header: string }> {
    const client = await this.getClientByClientId(clientId);
    if (!client) {
      throw new NotFoundError(`Client with ID ${clientId} not found`);
    }

    const newSecret = generateClientSecret();
    const newHash = await hashSecret(newSecret);
    const now = new Date().toISOString();

    client.client_secret_hash = newHash;
    client.updated_at = now;

    if (this.useMemory || inMemoryClients.has(clientId)) {
      inMemoryClients.set(clientId, client);
    }

    if (!this.useMemory) {
      try {
        const db = getFirestoreDb();
        await db.collection(COLLECTION_NAME).doc(clientId).update({
          client_secret_hash: newHash,
          updated_at: now,
        });
      } catch (_) {}
    }

    return {
      newSecret,
      credential_header: createCredentialString(clientId, newSecret),
    };
  }

  /**
   * Revokes client access permanently
   */
  async revokeClient(clientId: string): Promise<boolean> {
    return this.updateStatus(clientId, 'revoked');
  }

  /**
   * Disables client access temporarily
   */
  async disableClient(clientId: string): Promise<boolean> {
    return this.updateStatus(clientId, 'disabled');
  }

  /**
   * Re-enables client access
   */
  async enableClient(clientId: string): Promise<boolean> {
    return this.updateStatus(clientId, 'active');
  }

  private async updateStatus(clientId: string, status: ApiClientStatus): Promise<boolean> {
    const client = await this.getClientByClientId(clientId);
    if (!client) {
      throw new NotFoundError(`Client with ID ${clientId} not found`);
    }

    const now = new Date().toISOString();
    client.status = status;
    client.updated_at = now;

    if (this.useMemory || inMemoryClients.has(clientId)) {
      inMemoryClients.set(clientId, client);
    }

    if (!this.useMemory) {
      try {
        const db = getFirestoreDb();
        await db.collection(COLLECTION_NAME).doc(clientId).update({
          status,
          updated_at: now,
        });
      } catch (_) {}
    }

    return true;
  }

  /**
   * Updates granted permissions for a client
   */
  async updatePermissions(clientId: string, permissions: ApiPermission[]): Promise<boolean> {
    const client = await this.getClientByClientId(clientId);
    if (!client) {
      throw new NotFoundError(`Client with ID ${clientId} not found`);
    }

    const now = new Date().toISOString();
    client.permissions = permissions;
    client.updated_at = now;

    if (this.useMemory || inMemoryClients.has(clientId)) {
      inMemoryClients.set(clientId, client);
    }

    if (!this.useMemory) {
      try {
        const db = getFirestoreDb();
        await db.collection(COLLECTION_NAME).doc(clientId).update({
          permissions,
          updated_at: now,
        });
      } catch (_) {}
    }

    return true;
  }

  /**
   * Updates allowed branch IDs
   */
  async updateAllowedBranches(clientId: string, allowedBranchIds: string[]): Promise<boolean> {
    const client = await this.getClientByClientId(clientId);
    if (!client) {
      throw new NotFoundError(`Client with ID ${clientId} not found`);
    }

    const now = new Date().toISOString();
    client.allowed_branch_ids = allowedBranchIds;
    client.updated_at = now;

    if (this.useMemory || inMemoryClients.has(clientId)) {
      inMemoryClients.set(clientId, client);
    }

    if (!this.useMemory) {
      try {
        const db = getFirestoreDb();
        await db.collection(COLLECTION_NAME).doc(clientId).update({
          allowed_branch_ids: allowedBranchIds,
          updated_at: now,
        });
      } catch (_) {}
    }

    return true;
  }

  /**
   * Updates allowed CORS origins
   */
  async updateAllowedOrigins(clientId: string, allowedOrigins: string[]): Promise<boolean> {
    const client = await this.getClientByClientId(clientId);
    if (!client) {
      throw new NotFoundError(`Client with ID ${clientId} not found`);
    }

    const now = new Date().toISOString();
    client.allowed_origins = allowedOrigins;
    client.updated_at = now;

    if (this.useMemory || inMemoryClients.has(clientId)) {
      inMemoryClients.set(clientId, client);
    }

    if (!this.useMemory) {
      try {
        const db = getFirestoreDb();
        await db.collection(COLLECTION_NAME).doc(clientId).update({
          allowed_origins: allowedOrigins,
          updated_at: now,
        });
      } catch (_) {}
    }

    return true;
  }

  // Clear memory cache (useful in tests)
  clearMemory() {
    inMemoryClients.clear();
  }
}

export const defaultApiClientService = new ApiClientService();
