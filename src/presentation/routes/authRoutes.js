/**
 * Auth Routes — Presentation Layer
 *
 * Maps HTTP endpoints to AuthController methods.
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

  /**
   * @openapi
   * /auth/register:
   *   post:
   *     tags:
   *       - Auth
   *     summary: Register a new user
   *     description: Creates a new user account. Automatically assigns the Viewer role.
   *     security: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - name
   *               - email
   *               - password
   *             properties:
   *               name:
   *                 type: string
   *                 example: John Doe
   *               email:
   *                 type: string
   *                 format: email
   *                 example: john@example.com
   *               password:
   *                 type: string
   *                 format: password
   *                 example: SecureP@ss123
   *     responses:
   *       201:
   *         description: User created successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                   example: success
   *                 data:
   *                   type: object
   *                   properties:
   *                     user:
   *                       $ref: '#/components/schemas/User'
   *                     accessToken:
   *                       type: string
   *       400:
   *         description: Validation error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.post('/register', validateRegister, authController.register);

  /**
   * @openapi
   * /auth/login:
   *   post:
   *     tags:
   *       - Auth
   *     summary: Login
   *     description: Authenticate with email/password. Returns access token in body and refresh token as HttpOnly cookie. Rate limited.
   *     security: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - email
   *               - password
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *                 example: john@example.com
   *               password:
   *                 type: string
   *                 example: SecureP@ss123
   *     responses:
   *       200:
   *         description: Login successful
   *       401:
   *         description: Invalid credentials
   */
  router.post('/login', validateLogin, authController.login);

  /**
   * @openapi
   * /auth/refresh:
   *   post:
   *     tags:
   *       - Auth
   *     summary: Refresh access token
   *     description: Uses the HttpOnly refresh token cookie to issue a new access token.
   *     security: []
   *     responses:
   *       200:
   *         description: New access token issued
   *       401:
   *         description: Invalid or expired refresh token
   */
  router.post('/refresh', authController.refresh);

  /**
   * @openapi
   * /auth/logout:
   *   post:
   *     tags:
   *       - Auth
   *     summary: Logout
   *     description: Revokes the current access and refresh tokens.
   *     responses:
   *       200:
   *         description: Logged out successfully
   *       401:
   *         description: Not authenticated
   */
  router.post('/logout', authenticate, authController.logout);

  return router;
}
