import cors from 'cors';
import { env } from '../config/environment.js';

export function createCorsMiddleware() {
  const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());

  return cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) {
        return callback(null, true);
      }

      if (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS Error: Origin ${origin} not allowed`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Branch-ID'],
    exposedHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    credentials: true,
    maxAge: 86400, // 24 hours
  });
}
