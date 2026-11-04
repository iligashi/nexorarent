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
  JWT_SECRET: z.string().default(''),
  JWT_REFRESH_SECRET: z.string().default(''),
  CLIENT_URL: z.string().default('http://localhost:3000,http://localhost:3001'),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
});

const productionSecretSchema = z.string()
  .min(32, 'must be at least 32 characters')
  .refine(value => !/change.?me|your_|example|placeholder/i.test(value), 'must not be a placeholder');

export function validateEnvironment(env) {
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

  if (errors.length) {
    throw new Error(`Invalid environment configuration: ${errors.join('; ')}`);
  }

  return config;
}

export const config = validateEnvironment(process.env);

export const refreshCookieOptions = {
  httpOnly: true,
  secure: config.NODE_ENV === 'production',
  sameSite: config.COOKIE_SAME_SITE,
  path: '/api/v1/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};
