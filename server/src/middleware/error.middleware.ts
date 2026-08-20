import { Request, Response, NextFunction } from 'express';
import { env } from '../config/environment.js';
import { AuthenticatedRequest } from '../types/api.types.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { sendError } from '../utils/response.js';

export function errorHandler(
  err: Error,
  req: AuthenticatedRequest,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  let statusCode = 500;
  let code = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected server error occurred';
  let details: any = undefined;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err.name === 'SyntaxError' && 'body' in err) {
    statusCode = 400;
    code = 'MALFORMED_JSON';
    message = 'Invalid JSON syntax in request body';
  }

  // Log error with context
  logger.error(err.message, {
    request_id: req.requestId,
    client_id: req.apiClient?.clientId,
    tenant_id: req.apiClient?.tenantId,
    endpoint: req.originalUrl || req.url,
    method: req.method,
    status: statusCode,
    details: env.NODE_ENV !== 'production' ? err.stack : undefined,
  });

  // Never leak internal stack traces or secrets in production
  const safeDetails = env.NODE_ENV === 'production' && statusCode === 500 ? undefined : details;

  sendError(res, code, message, statusCode, safeDetails);
}
