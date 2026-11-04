import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import pool, { query } from './db/pool.js';
import { logger } from './utils/logger.js';
import { auditAdminAction, requestContext } from './middleware/request-context.js';
import { requireJsonObject } from './middleware/json-object.js';

import authRoutes from './routes/auth.routes.js';
import carRoutes from './routes/cars.routes.js';
import reservationRoutes from './routes/reservations.routes.js';
import adminRoutes from './routes/admin.routes.js';
import locationRoutes from './routes/locations.routes.js';
import extraRoutes from './routes/extras.routes.js';
import reviewRoutes from './routes/reviews.routes.js';
import blogRoutes from './routes/blog.routes.js';
import contactRoutes from './routes/contact.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import adminReviewRoutes from './routes/admin.reviews.routes.js';
import adminExpenseRoutes from './routes/admin.expenses.routes.js';
import adminMaintenanceRoutes from './routes/admin.maintenance.routes.js';
import adminPricingRoutes from './routes/admin.pricing.routes.js';
import adminLoyaltyRoutes from './routes/admin.loyalty.routes.js';
import adminNotificationRoutes from './routes/admin.notifications.routes.js';
import adminDeliveryRoutes from './routes/admin.delivery.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.disable('x-powered-by');
app.use(requestContext);

// Trust proxy when behind reverse proxy (Railway, etc.)
if (config.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Middleware
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000,http://localhost:3001')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
const isAllowedDevelopmentOrigin = origin =>
  process.env.NODE_ENV !== 'production' &&
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || isAllowedDevelopmentOrigin(origin)) {
      return callback(null, true);
    }

    return callback(null, false);
  },
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb', parameterLimit: 100 }));
app.use(requireJsonObject);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/register', authLimiter);

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/v1/contact', contactLimiter);

const reservationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/v1/reservations', reservationLimiter);

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/v1/upload', uploadLimiter);
app.use('/api/v1/admin/cars/:id/images', uploadLimiter);
app.use('/api/v1/admin', auditAdminAction);
app.use('/api/v1/upload', auditAdminAction);

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/cars', carRoutes);
app.use('/api/v1/reservations', reservationRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/locations', locationRoutes);
app.use('/api/v1/extras', extraRoutes);
app.use('/api/v1/reviews', reviewRoutes);
app.use('/api/v1/blog', blogRoutes);
app.use('/api/v1/contact', contactRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/admin/reviews', adminReviewRoutes);
app.use('/api/v1/admin/expenses', adminExpenseRoutes);
app.use('/api/v1/admin/maintenance', adminMaintenanceRoutes);
app.use('/api/v1/admin/pricing', adminPricingRoutes);
app.use('/api/v1/admin/loyalty', adminLoyaltyRoutes);
app.use('/api/v1/admin/notifications', adminNotificationRoutes);
app.use('/api/v1/admin/deliveries', adminDeliveryRoutes);

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ok', database: 'ok', timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('health_check_database_failed', { requestId: req.requestId, error: error.message });
    res.status(503).json({ status: 'degraded', database: 'unavailable', timestamp: new Date().toISOString() });
  }
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  const status = err.status || (err.type === 'entity.too.large' ||
    (err.name === 'MulterError' && ['LIMIT_FILE_SIZE', 'LIMIT_FILE_COUNT'].includes(err.code)) ? 413 :
    err.name === 'MulterError' ? 400 : 500);
  logger.error('request_failed', {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl.split('?')[0],
    userId: req.user?.id,
    statusCode: status,
    error: err.message,
    stack: config.NODE_ENV === 'production' ? undefined : err.stack,
  });
  res.status(status).json({
    error: config.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    requestId: req.requestId,
  });
});

const server = app.listen(config.PORT, () => {
  logger.info('server_started', { port: config.PORT, environment: config.NODE_ENV });
});

function shutdown(signal) {
  logger.info('server_shutdown_started', { signal });
  server.close(error => {
    if (error) {
      logger.error('server_shutdown_failed', { signal, error: error.message });
      process.exitCode = 1;
    }
    pool.end().catch(poolError => {
      logger.error('database_pool_shutdown_failed', { error: poolError.message });
      process.exitCode = 1;
    });
  });
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

export default app;
