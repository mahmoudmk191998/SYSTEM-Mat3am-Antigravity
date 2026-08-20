import { Response, NextFunction } from 'express';
import { env } from '../config/environment.js';
import { AuthenticatedRequest } from '../types/api.types.js';
import { RateLimitError } from '../utils/errors.js';
import { parseCredentialString } from '../utils/crypto.js';
import { defaultApiClientService } from '../services/apiClient.service.js';

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
}, 60000).unref();

export function resolveClientRateLimit(tier?: string, fallbackLimit: number = env.API_RATE_LIMIT): number {
  if (tier === 'premium') {
    return env.API_RATE_LIMIT_PREMIUM;
  }
  if (tier === 'standard') {
    return env.API_RATE_LIMIT_STANDARD;
  }
  if (tier === 'free') {
    return env.API_RATE_LIMIT_DEFAULT;
  }
  return fallbackLimit;
}

export function createRateLimiter(
  maxRequests: number = env.API_RATE_LIMIT,
  windowMs: number = env.API_RATE_WINDOW_MS
) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    let key = req.apiClient?.clientId;
    let tier = req.apiClient?.rateLimitTier;

    if (!key && req.header('Authorization')) {
      const auth = req.header('Authorization')!;
      if (auth.startsWith('Bearer ')) {
        const parsed = parseCredentialString(auth.slice(7).trim());
        if (parsed?.clientId) {
          key = parsed.clientId;
          try {
            const client = await defaultApiClientService.getClientByClientId(parsed.clientId);
            tier = client?.rate_limit_tier;
          } catch (_) {}
        }
      }
    }

    key = key || req.ip || req.socket.remoteAddress || 'unknown';

    const now = Date.now();
    const effectiveLimit = resolveClientRateLimit(tier, maxRequests);

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

    const remaining = Math.max(0, effectiveLimit - record.count);
    const resetSeconds = Math.ceil((record.resetTime - now) / 1000);

    res.setHeader('X-RateLimit-Limit', effectiveLimit.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader('X-RateLimit-Reset', resetSeconds.toString());

    if (record.count > effectiveLimit) {
      res.setHeader('Retry-After', resetSeconds.toString());
      return next(
        new RateLimitError(`Rate limit of ${effectiveLimit} requests per ${windowMs / 1000}s exceeded`)
      );
    }

    next();
  };
}

export function resetRateLimits(): void {
  rateLimitStore.clear();
}
