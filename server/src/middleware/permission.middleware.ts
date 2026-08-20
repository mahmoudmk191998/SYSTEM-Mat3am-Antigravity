import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/api.types.js';
import { ApiPermission } from '../types/permissions.types.js';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';

export function requirePermission(requiredPermission: ApiPermission) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.apiClient) {
      return next(new UnauthorizedError('Authentication required before checking permissions'));
    }

    const hasPerm = req.apiClient.permissions.includes(requiredPermission);
    if (!hasPerm) {
      return next(
        new ForbiddenError(
          `Permission denied: Missing required permission '${requiredPermission}'`
        )
      );
    }

    next();
  };
}

export function requireAnyPermission(permissions: ApiPermission[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.apiClient) {
      return next(new UnauthorizedError('Authentication required before checking permissions'));
    }

    const hasAny = permissions.some((p) => req.apiClient?.permissions.includes(p));
    if (!hasAny) {
      return next(
        new ForbiddenError(
          `Permission denied: Requires at least one of permissions: [${permissions.join(', ')}]`
        )
      );
    }

    next();
  };
}

export function requireAllPermissions(permissions: ApiPermission[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.apiClient) {
      return next(new UnauthorizedError('Authentication required before checking permissions'));
    }

    const missing = permissions.filter((p) => !req.apiClient?.permissions.includes(p));
    if (missing.length > 0) {
      return next(
        new ForbiddenError(
          `Permission denied: Missing required permissions: [${missing.join(', ')}]`
        )
      );
    }

    next();
  };
}
