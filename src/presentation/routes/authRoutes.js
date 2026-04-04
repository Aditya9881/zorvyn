/**
 * Auth Routes — Presentation Layer
 *
 * Maps HTTP endpoints to AuthController methods.
 *
 * POST /api/v1/auth/register  → Register new user (public)
 * POST /api/v1/auth/login     → Login (public)
 * POST /api/v1/auth/refresh   → Refresh access token (cookie-based)
 * POST /api/v1/auth/logout    → Logout (authenticated)
 */

import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { validateRegister, validateLogin } from '../validators/authValidators.js';

/**
 * Creates auth routes with injected controller.
 * @param {import('../controllers/AuthController').AuthController} authController
 * @returns {Router}
 */
export function createAuthRoutes(authController) {
  const router = Router();

  router.post('/register', validateRegister, authController.register);
  router.post('/login', validateLogin, authController.login);
  router.post('/refresh', authController.refresh);
  router.post('/logout', authenticate, authController.logout);

  return router;
}
