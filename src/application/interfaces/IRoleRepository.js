/**
 * IRoleRepository — Repository Interface (Application Layer)
 *
 * Contract for role data access via the user_roles junction table.
 */

export const IRoleRepository = {
  findById: 'findById(id) → Role | null',
  findByName: 'findByName(name) → Role | null',
  findByUserId: 'findByUserId(userId) → Role[]',
  assignToUser: 'assignToUser(userId, roleId) → void',
  removeFromUser: 'removeFromUser(userId, roleId) → void',
};
