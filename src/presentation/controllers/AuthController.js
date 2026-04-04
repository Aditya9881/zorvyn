/**
 * AuthController — Presentation Layer
 *
 * Thin controller that delegates to AuthService.
 * Handles HTTP concerns: reading request body, setting cookies, sending responses.
 *
 * Per DEVELOPMENT_SPEC.md Section VII:
 * - Refresh token is set as HttpOnly, SameSite=Strict, Secure cookie
 * - Access token is returned in the response body
 */

export class AuthController {
  /**
   * @param {import('../../application/services/AuthService').AuthService} authService
   */
  constructor(authService) {
    this.authService = authService;
  }

  /**
   * POST /api/v1/auth/register
   */
  register = async (req, res, next) => {
    try {
      const { name, email, password } = req.body;
      const result = await this.authService.register({ name, email, password });

      this._setRefreshCookie(res, result.refreshToken);

      return res.status(201).json({
        status: 'success',
        data: {
          user: result.user,
          accessToken: result.accessToken,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/v1/auth/login
   */
  login = async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const result = await this.authService.login({ email, password });

      this._setRefreshCookie(res, result.refreshToken);

      return res.status(200).json({
        status: 'success',
        data: {
          user: result.user,
          accessToken: result.accessToken,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/v1/auth/refresh
   */
  refresh = async (req, res, next) => {
    try {
      const refreshToken = req.cookies?.refreshToken;
      if (!refreshToken) {
        return res.status(401).json({
          type: 'https://api.zorvyn.com/errors/authentication-error',
          title: 'Authentication Error',
          status: 401,
          detail: 'Refresh token not found in cookies.',
        });
      }

      const result = await this.authService.refresh(refreshToken);

      this._setRefreshCookie(res, result.refreshToken);

      return res.status(200).json({
        status: 'success',
        data: {
          accessToken: result.accessToken,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/v1/auth/logout
   * Requires authentication (applied via route middleware).
   */
  logout = (req, res, next) => {
    try {
      this.authService.logout(req.user.jti);

      res.clearCookie('refreshToken');

      return res.status(200).json({
        status: 'success',
        data: { message: 'Logged out successfully.' },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Sets the refresh token as an HttpOnly, Secure, SameSite=Strict cookie.
   * Per spec: "By using HttpOnly cookies, the browser automatically attaches
   * the token to requests, but the application's JavaScript cannot read it."
   */
  _setRefreshCookie(res, token) {
    res.cookie('refreshToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
      path: '/api/v1/auth',
    });
  }
}
