import { Response, NextFunction } from 'express';
import { defaultApiClientService, ApiClientService } from '../services/apiClient.service.js';
import { AuthenticatedRequest } from '../types/api.types.js';
import { parseCredentialString } from '../utils/crypto.js';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';

export function createAuthMiddleware(clientService: ApiClientService = defaultApiClientService) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (req.apiClient) {
        return next();
      }

      const authHeader = req.header('Authorization');

      if (!authHeader) {
        throw new UnauthorizedError('Missing Authorization header. Use Bearer <credential>');
      }

      if (!authHeader.startsWith('Bearer ')) {
        throw new UnauthorizedError('Invalid authorization scheme. Bearer token is required');
      }

      const rawCredential = authHeader.slice('Bearer '.length).trim();
      if (!rawCredential) {
        throw new UnauthorizedError('Missing API credential token');
      }

      const parsed = parseCredentialString(rawCredential);
      if (!parsed) {
        throw new UnauthorizedError('Invalid API credential format');
      }

      // Verify against client credentials database
      const client = await clientService.verifyCredentials(parsed.clientId, parsed.secret);

      // Set verified request context
      req.apiClient = {
        clientId: client.client_id,
        tenantId: client.tenant_id,
        allowedBranchIds: client.allowed_branch_ids || [],
        permissions: client.permissions || [],
        rateLimitTier: client.rate_limit_tier,
      };

      // Strict Origin Access Control:
      const requestOrigin = req.header('Origin');
      if (requestOrigin && client.allowed_origins && client.allowed_origins.length > 0) {
        if (!client.allowed_origins.includes(requestOrigin)) {
          throw new ForbiddenError(
            `CORS Forbidden: Origin '${requestOrigin}' is not allowed for this API client`
          );
        }
      }

      // Strict Tenant Isolation Guard:
      // Prevent requests from attempting to supply a different tenant_id in body, query, or headers
      if (req.body && req.body.tenant_id && req.body.tenant_id !== client.tenant_id) {
        throw new ForbiddenError(
          `Tenant mismatch: You are authenticated for tenant '${client.tenant_id}' and cannot specify a different tenant_id`
        );
      }

      if (req.query && req.query.tenant_id && req.query.tenant_id !== client.tenant_id) {
        throw new ForbiddenError(
          `Tenant mismatch: You are authenticated for tenant '${client.tenant_id}' and cannot specify a different tenant_id`
        );
      }

      // Auto-inject authenticated tenant into request body if applicable
      if (req.body && typeof req.body === 'object') {
        req.body.tenant_id = client.tenant_id;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export const authenticateApiKey = createAuthMiddleware();
