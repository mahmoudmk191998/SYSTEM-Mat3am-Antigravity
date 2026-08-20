import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  
  // Rate limiting config (configurable, not hardcoded)
  API_RATE_LIMIT: z.coerce.number().default(100),
  API_RATE_WINDOW_MS: z.coerce.number().default(60000), // 1 minute
  
  // CORS configuration
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000,http://localhost:5173,http://localhost:4000'),
  
  // Firebase Admin Credentials
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  
  // Optional path to service account json
  FIREBASE_SERVICE_ACCOUNT_PATH: z.string().optional(),
});

export type Environment = z.infer<typeof envSchema>;

function parseEnv(): Environment {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid environment variables:', result.error.format());
    throw new Error('Invalid environment configuration');
  }
  return result.data;
}

export const env = parseEnv();
