/**
 * Application Entry Point
 *
 * Bootstraps the Express app with:
 * 1. Middleware (JSON parser, cookie parser, rate limiter)
 * 2. Database connection and migrations
 * 3. Dependency injection (repositories → services → controllers)
 * 4. Route mounting with audit middleware
 * 5. Swagger documentation
 * 6. Global error handler
 */

import express from 'express';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import config from './config/index.js';
import { swaggerSpec } from './config/swagger.js';
import { getDatabase } from './infrastructure/database/connection.js';
import { runMigrations } from './infrastructure/database/migrator.js';

// Repositories
import { SqliteUserRepository } from './infrastructure/repositories/SqliteUserRepository.js';
import { SqliteRoleRepository } from './infrastructure/repositories/SqliteRoleRepository.js';
import { SqlitePermissionRepository } from './infrastructure/repositories/SqlitePermissionRepository.js';
import { SqliteTransactionRepository } from './infrastructure/repositories/SqliteTransactionRepository.js';
import { SqliteAuditLogRepository } from './infrastructure/repositories/SqliteAuditLogRepository.js';
import { SqliteIdempotencyRepository } from './infrastructure/repositories/SqliteIdempotencyRepository.js';
import { SqliteBudgetRepository } from './infrastructure/repositories/SqliteBudgetRepository.js';

// Services
import { AuthService } from './application/services/AuthService.js';
import { UserService } from './application/services/UserService.js';
import { TransactionService } from './application/services/TransactionService.js';
import { BudgetService } from './application/services/BudgetService.js';
import { InsightService } from './application/services/InsightService.js';

// Controllers
import { AuthController } from './presentation/controllers/AuthController.js';
import { TransactionController } from './presentation/controllers/TransactionController.js';
import { UserController } from './presentation/controllers/UserController.js';
import { BudgetController } from './presentation/controllers/BudgetController.js';
import { AuditLogController } from './presentation/controllers/AuditLogController.js';
import { InsightController } from './presentation/controllers/InsightController.js';

// Routes
import { createAuthRoutes } from './presentation/routes/authRoutes.js';
import { createTransactionRoutes } from './presentation/routes/transactionRoutes.js';
import { createAnalyticsRoutes } from './presentation/routes/analyticsRoutes.js';
import { createUserRoutes } from './presentation/routes/userRoutes.js';
import { createBudgetRoutes } from './presentation/routes/budgetRoutes.js';
import { createAuditLogRoutes } from './presentation/routes/auditLogRoutes.js';

// Middleware
import { errorHandler } from './presentation/middleware/errorHandler.js';
import { generalLimiter, loginLimiter } from './presentation/middleware/rateLimiter.js';
import { idempotency } from './presentation/middleware/idempotencyMiddleware.js';

/**
 * Creates and configures the Express application.
 * Exported for use in tests (supertest).
 * @param {import('better-sqlite3').Database} [db] - Optional db instance for testing
 * @param {object} [opts={}] - Options
 * @param {boolean} [opts.enableRateLimiting=false] - Enable rate limiting (disabled in tests)
 * @returns {express.Application}
 */
export function createApp(db, opts = {}) {
  const app = express();

  // ─── Global Middleware ────────────────────────────────────────
  app.use(express.json());
  app.use(cookieParser());

  // Rate limiting (disabled in tests to avoid flaky timing issues)
  if (opts.enableRateLimiting) {
    app.use('/api/v1', generalLimiter);
    app.use('/api/v1/auth/login', loginLimiter);
  }

  // ─── Database ─────────────────────────────────────────────────
  const database = db || getDatabase();
  runMigrations(database);

  // ─── Dependency Injection ─────────────────────────────────────
  const userRepository = new SqliteUserRepository(database);
  const roleRepository = new SqliteRoleRepository(database);
  const permissionRepository = new SqlitePermissionRepository(database);
  const transactionRepository = new SqliteTransactionRepository(database);
  const auditLogRepository = new SqliteAuditLogRepository(database);
  const idempotencyRepository = new SqliteIdempotencyRepository(database);
  const budgetRepository = new SqliteBudgetRepository(database);

  const authService = new AuthService({
    userRepository,
    roleRepository,
    permissionRepository,
  });

  const userService = new UserService({
    userRepository,
    roleRepository,
    permissionRepository,
  });

  const transactionService = new TransactionService({
    transactionRepository,
  });

  const budgetService = new BudgetService({
    budgetRepository,
    transactionRepository,
  });

  const insightService = new InsightService({
    transactionRepository,
    budgetRepository,
  });

  const authController = new AuthController(authService);
  const transactionController = new TransactionController(transactionService);
  const userController = new UserController(userService);
  const budgetController = new BudgetController(budgetService);
  const auditLogController = new AuditLogController(auditLogRepository);
  const insightController = new InsightController(insightService);

  // ─── Routes ───────────────────────────────────────────────────
  app.use('/api/v1/auth', createAuthRoutes(authController));
  app.use('/api/v1/transactions', createTransactionRoutes(transactionController, {
    idempotencyMiddleware: idempotency(idempotencyRepository),
  }));
  app.use('/api/v1/analytics', createAnalyticsRoutes(transactionController, {
    insightController,
  }));
  app.use('/api/v1/users', createUserRoutes(userController));
  app.use('/api/v1/budgets', createBudgetRoutes(budgetController));
  app.use('/api/v1/audit-logs', createAuditLogRoutes(auditLogController));

  // ─── Health Check ─────────────────────────────────────────────
  app.get('/api/v1/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ─── Swagger Documentation ────────────────────────────────────
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // ─── Global Error Handler (must be last) ──────────────────────
  app.use(errorHandler);

  // ─── Expose internals for tests ───────────────────────────────
  app._auditLogRepository = auditLogRepository;

  return app;
}

// ─── Start Server (only when run directly) ─────────────────────
const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith('index.js') || process.argv[1].includes('src/index'));

if (isDirectRun) {
  const app = createApp(undefined, { enableRateLimiting: true });
  app.listen(config.port, () => {
    console.log(`🚀 Zorvyn API running on http://localhost:${config.port}`);
    console.log(`   Environment: ${config.nodeEnv}`);
    console.log(`   API Docs: http://localhost:${config.port}/api-docs`);
  });
}
