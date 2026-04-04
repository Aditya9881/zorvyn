/**
 * UserController — Presentation Layer
 *
 * Thin controller for Admin-only user management operations.
 * All routes require authenticate + authorize('manage_users').
 */

export class UserController {
  /**
   * @param {import('../../application/services/UserService').UserService} userService
   */
  constructor(userService) {
    this.userService = userService;
  }

  /**
   * GET /api/v1/users — List all active users
   */
  listUsers = (req, res, next) => {
    try {
      const users = this.userService.listUsers();

      return res.status(200).json({
        status: 'success',
        data: { users },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/users/:id — Get single user with roles/permissions
   */
  getUserById = (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      const user = this.userService.getUserById(id);

      return res.status(200).json({
        status: 'success',
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/v1/users/:id/roles — Assign a role
   */
  assignRole = (req, res, next) => {
    try {
      const userId = parseInt(req.params.id, 10);
      const { role } = req.body;

      if (!role || typeof role !== 'string') {
        return res.status(400).json({
          type: 'https://api.zorvyn.com/errors/validation-error',
          title: 'Validation Error',
          status: 400,
          detail: 'Role name is required in request body.',
        });
      }

      const user = this.userService.assignRole(userId, role);

      return res.status(200).json({
        status: 'success',
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /api/v1/users/:id/roles/:roleName — Remove a role
   */
  removeRole = (req, res, next) => {
    try {
      const userId = parseInt(req.params.id, 10);
      const { roleName } = req.params;

      const user = this.userService.removeRole(userId, roleName);

      return res.status(200).json({
        status: 'success',
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/v1/users/:id/deactivate — Deactivate + revoke tokens
   */
  deactivateUser = (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      const result = this.userService.deactivateUser(id);

      return res.status(200).json({
        status: 'success',
        data: {
          user: result.user,
          tokensRevoked: result.tokensRevoked,
          message: `User deactivated. ${result.tokensRevoked} token(s) revoked.`,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/v1/users/:id/activate — Reactivate user
   */
  activateUser = (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      const user = this.userService.activateUser(id);

      return res.status(200).json({
        status: 'success',
        data: { user, message: 'User reactivated successfully.' },
      });
    } catch (error) {
      next(error);
    }
  };
}
