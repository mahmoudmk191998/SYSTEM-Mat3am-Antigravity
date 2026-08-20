import { Request, Response } from 'express';
import { defaultRateLimitStore } from '../infrastructure/rate-limit/rateLimitStore.js';
import { defaultWebhookQueue } from '../infrastructure/webhooks/webhookQueue.js';

export async function getHealthCheck(req: Request, res: Response): Promise<void> {
  const rateLimitStatus = defaultRateLimitStore.getStatus();
  const webhookStatus = await defaultWebhookQueue.getStatus();

  const isDegraded = rateLimitStatus.status === 'degraded' || webhookStatus.status === 'degraded';

  res.status(200).json({
    success: true,
    service: 'rms-api',
    version: 'v1',
    status: isDegraded ? 'degraded' : 'healthy',
    infrastructure: {
      rateLimitStore: {
        provider: rateLimitStatus.provider,
        status: rateLimitStatus.status,
      },
      webhookQueue: {
        provider: webhookStatus.provider,
        status: webhookStatus.status,
        pending_jobs: webhookStatus.pending_jobs,
      },
    },
  });
}
