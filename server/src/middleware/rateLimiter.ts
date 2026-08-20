import { Response, NextFunction } from 'express';
import { env } from '../config/environment.js';
import { AuthenticatedRequest } from '../types/api.types.js';
import { RateLimitError } from '../utils/errors.js';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Cleanup stale records periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60000);

export function createRateLimiter(
  maxRequests: number = env.API_RATE_LIMIT,
  windowMs: number = env.API_RATE_WINDOW_MS
) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    // Key by client_id if authenticated, or by IP address
    const key = req.apiClient?.clientId || req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    let record = rateLimitStore.get(key);

    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs,
      };
      rateLimitStore.set(key, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, maxRequests - record.count);
    const resetSeconds = Math.ceil((record.resetTime - now) / 1000);

    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader('X-RateLimit-Reset', resetSeconds.toString());

    if (record.count > maxRequests) {
      return next(new RateLimitError(`Rate limit of ${maxRequests} requests per ${windowMs / 1000}s exceeded`));
    }

    next();
  };
}

export function resetRateLimits(): void {
  rateLimitStore.clear();
}
