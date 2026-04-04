/**
 * IPermissionRepository — Repository Interface (Application Layer)
 *
 * Contract for permission data access. The critical method is
 * findByUserId which resolves the full chain:
 *   user → user_roles → roles → role_permissions → permissions
 */

export const IPermissionRepository = {
  findByRoleId: 'findByRoleId(roleId) → Permission[]',
  findByUserId: 'findByUserId(userId) → Permission[] (resolved through roles)',
};
