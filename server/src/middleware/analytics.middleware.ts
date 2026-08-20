import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/api.types.js';
import { defaultAnalyticsService, AnalyticsService } from '../services/analytics.service.js';

export function createAnalyticsMiddleware(
  analyticsService: AnalyticsService = defaultAnalyticsService
) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const startTime = req.startTime || Date.now();

    res.on('finish', () => {
      // Only track if authenticated client is present
      if (req.apiClient) {
        const responseTime = Date.now() - startTime;
        const tenantId = req.apiClient.tenantId;
        const clientId = req.apiClient.clientId;
        const endpoint = req.baseUrl ? `${req.baseUrl}${req.path}` : req.originalUrl.split('?')[0];
        const method = req.method;
        const statusCode = res.statusCode;
        const requestId = req.requestId || 'req_unknown';

        analyticsService
          .recordUsageEvent({
            tenant_id: tenantId,
            client_id: clientId,
            endpoint,
            method,
            status_code: statusCode,
            response_time_ms: responseTime,
            request_id: requestId,
            timestamp: new Date().toISOString(),
          })
          .catch(() => {});
      }
    });

    next();
  };
}

export const analyticsMiddleware = createAnalyticsMiddleware();
