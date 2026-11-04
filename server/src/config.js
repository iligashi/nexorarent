import 'dotenv/config';
import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DB_HOST: z.string().min(1).default('localhost'),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
  DB_NAME: z.string().min(1).default('drenas_rentacar'),
  DB_USER: z.string().min(1).default('root'),
  DB_PASSWORD: z.string().default(''),
  REDIS_URL: z.string().url().optional(),
  OBJECT_STORAGE_BUCKET: z.string().min(1).optional(),
  OBJECT_STORAGE_REGION: z.string().min(1).optional(),
  OBJECT_STORAGE_ENDPOINT: z.string().url().optional(),
  OBJECT_STORAGE_PUBLIC_URL: z.string().url().optional(),
  OBJECT_STORAGE_FORCE_PATH_STYLE: z.enum(['true', 'false']).default('false'),
  MIGRATION_DB_USER: z.string().min(1).optional(),
  MIGRATION_DB_PASSWORD: z.string().optional(),
  JWT_SECRET: z.string().default(''),
  JWT_REFRESH_SECRET: z.string().default(''),
  CLIENT_URL: z.string().default('http://localhost:3000,http://localhost:3001'),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
});

const productionSecretSchema = z.string()
  .min(32, 'must be at least 32 characters')
  .refine(value => !/change.?me|your_|example|placeholder/i.test(value), 'must not be a placeholder');

export function validateEnvironment(env, mode = 'application') {
  const parsed = environmentSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`);
  }

  const config = parsed.data;
  const errors = [];

  if (config.NODE_ENV === 'production') {
    for (const key of ['DB_HOST', 'DB_NAME', 'DB_USER']) {
      if (!env[key]?.trim()) errors.push(`${key} is required in production`);
    }
    if (mode === 'migration') {
      try {
        validateMigrationCredentials(env);
      } catch (error) {
        errors.push(error.message.replace('Invalid migration configuration: ', ''));
      }
    } else {
      if (!config.REDIS_URL) errors.push('REDIS_URL is required in production');
      if (!config.OBJECT_STORAGE_BUCKET) errors.push('OBJECT_STORAGE_BUCKET is required in production');
      if (!config.OBJECT_STORAGE_REGION) errors.push('OBJECT_STORAGE_REGION is required in production');
      if (!config.OBJECT_STORAGE_PUBLIC_URL) errors.push('OBJECT_STORAGE_PUBLIC_URL is required in production');
      if (config.OBJECT_STORAGE_PUBLIC_URL && !config.OBJECT_STORAGE_PUBLIC_URL.startsWith('https://')) {
        errors.push('OBJECT_STORAGE_PUBLIC_URL must use HTTPS in production');
      }
      if (config.OBJECT_STORAGE_ENDPOINT && !config.OBJECT_STORAGE_ENDPOINT.startsWith('https://')) {
        errors.push('OBJECT_STORAGE_ENDPOINT must use HTTPS in production');
      }
      if (!env.DB_PASSWORD) errors.push('DB_PASSWORD is required in production');
      if (!env.CLIENT_URL?.trim()) errors.push('CLIENT_URL is required in production');

      for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
        const result = productionSecretSchema.safeParse(env[key] || '');
        if (!result.success) errors.push(`${key} ${result.error.issues[0].message}`);
      }
      if (env.JWT_SECRET && env.JWT_SECRET === env.JWT_REFRESH_SECRET) {
        errors.push('JWT_SECRET and JWT_REFRESH_SECRET must be different');
      }
      if (!env.CLIENT_URL?.split(',').every(value => {
        try {
          const url = new URL(value.trim());
          return url.protocol === 'https:' && url.origin === value.trim();
        } catch {
          return false;
        }
      })) {
        errors.push('CLIENT_URL must contain comma-separated HTTPS origins in production');
      }
    }
  }

  if (errors.length) {
    throw new Error(`Invalid environment configuration: ${errors.join('; ')}`);
  }

  return config;
}

export function validateMigrationCredentials(env) {
  if ((env.NODE_ENV || 'development') !== 'production') return;

  const errors = [];
  if (!env.DB_USER?.trim()) errors.push('DB_USER is required as the runtime username');
  if (!env.MIGRATION_DB_USER?.trim()) errors.push('MIGRATION_DB_USER is required in production');
  if (!env.MIGRATION_DB_PASSWORD) errors.push('MIGRATION_DB_PASSWORD is required in production');
  if (env.MIGRATION_DB_USER && env.MIGRATION_DB_USER === env.DB_USER) {
    errors.push('MIGRATION_DB_USER must be different from DB_USER');
  }
  if (env.MIGRATION_DB_PASSWORD && env.MIGRATION_DB_PASSWORD === env.DB_PASSWORD) {
    errors.push('MIGRATION_DB_PASSWORD must be different from DB_PASSWORD');
  }
  if (errors.length) {
    throw new Error(`Invalid migration configuration: ${errors.join('; ')}`);
  }
}

export const config = validateEnvironment(
  process.env,
  process.env.CONFIG_MODE === 'migration' ? 'migration' : 'application'
);

export const refreshCookieOptions = {
  httpOnly: true,
  secure: config.NODE_ENV === 'production',
  sameSite: config.COOKIE_SAME_SITE,
  path: '/api/v1/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};
