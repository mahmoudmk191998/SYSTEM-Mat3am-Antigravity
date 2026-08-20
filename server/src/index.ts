import express from 'express';
import helmet from 'helmet';
import { env } from './config/environment.js';
import { initFirebaseAdmin } from './config/firebase.js';
import { createCorsMiddleware } from './middleware/cors.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';
import { requestLoggerMiddleware } from './middleware/logger.middleware.js';
import { analyticsMiddleware } from './middleware/analytics.middleware.js';
import { createRateLimiter } from './middleware/rateLimiter.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { v1Router } from './routes/v1/index.js';
import { v2Router } from './routes/v2/index.js';
import { NotFoundError } from './utils/errors.js';
import { logger } from './utils/logger.js';
import { defaultWebhookService } from './services/webhook.service.js';

export function createApp(): express.Application {
  const app = express();

  // 1. Security Headers via Helmet
  app.use(
    helmet({
      contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
      crossOriginEmbedderPolicy: false,
    })
  );

  // 2. CORS Protection
  app.use(createCorsMiddleware());

  // 3. Body parsers with safe limits
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // 4. Request ID tagging & performance timing
  app.use(requestIdMiddleware);

  // 5. Structured Request Logging
  app.use(requestLoggerMiddleware);

  // 6. Analytics Middleware (Non-blocking usage tracking)
  app.use(analyticsMiddleware);

  // 7. Configurable Rate Limiting
  app.use(createRateLimiter());

  // 8. Mount API Routes
  app.use('/api/v1', v1Router);
  app.use('/api/v2', v2Router);

  // 8. 404 handler for unmatched routes
  app.use((req, res, next) => {
    next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`));
  });

  // 9. Centralized Error Handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();

// Start server if run directly
if (process.env.NODE_ENV !== 'test') {
  initFirebaseAdmin();

  // Durable webhook outbox worker. Failed deliveries retain their retry schedule.
  setInterval(() => {
    defaultWebhookService.dispatchDue().catch((error) => logger.error('Webhook delivery sweep failed', { details: error instanceof Error ? error.message : error }));
  }, 60_000).unref();

  app.listen(env.PORT, () => {
    logger.info(`🚀 RMS REST API Server is running`, {
      endpoint: `http://localhost:${env.PORT}/api/v1/health`,
      details: {
        port: env.PORT,
        environment: env.NODE_ENV,
        rateLimit: env.API_RATE_LIMIT,
        rateWindowMs: env.API_RATE_WINDOW_MS,
      },
    });
  });
}
