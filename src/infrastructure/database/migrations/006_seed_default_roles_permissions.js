/**
 * Migration: Seed default roles and permissions
 *
 * Permission matrix (from DEVELOPMENT_SPEC.md):
 *
 * Permission           | Viewer | Analyst | Admin
 * ---------------------|--------|---------|------
 * read_transactions    |   ✓    |    ✓    |   ✓
 * read_analytics       |   ✗    |    ✓    |   ✓
 * export_data          |   ✗    |    ✓    |   ✓
 * create_transaction   |   ✗    |    ✗    |   ✓
 * update_transaction   |   ✗    |    ✗    |   ✓
 * delete_transaction   |   ✗    |    ✗    |   ✓
 * manage_users         |   ✗    |    ✗    |   ✓
 * manage_roles         |   ✗    |    ✗    |   ✓
 */

/** @param {import('better-sqlite3').Database} db */
export function up(db) {
  const insertRole = db.prepare(
    'INSERT OR IGNORE INTO roles (name, description) VALUES (?, ?)'
  );

  const insertPermission = db.prepare(
    'INSERT OR IGNORE INTO permissions (name, description) VALUES (?, ?)'
  );

  const assignPermission = db.prepare(`
    INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
    VALUES (
      (SELECT id FROM roles WHERE name = ?),
      (SELECT id FROM permissions WHERE name = ?)
    )
  `);

  const seed = db.transaction(() => {
    // --- Roles ---
    insertRole.run('Viewer', 'Read-only access to dashboard and transaction listings');
    insertRole.run('Analyst', 'Advanced analytics, exports, and historical trends');
    insertRole.run('Admin', 'Full lifecycle management over records and users');

    // --- Permissions ---
    insertPermission.run('read_transactions', 'View transaction listings and details');
    insertPermission.run('read_analytics', 'Access dashboard summaries and analytical endpoints');
    insertPermission.run('export_data', 'Export financial data for external use');
    insertPermission.run('create_transaction', 'Create new financial transaction records');
    insertPermission.run('update_transaction', 'Modify existing financial transaction records');
    insertPermission.run('delete_transaction', 'Soft-delete financial transaction records');
    insertPermission.run('manage_users', 'Manage user accounts: activate, deactivate, assign roles');
    insertPermission.run('manage_roles', 'Configure role-permission mappings');

    // --- Viewer permissions ---
    assignPermission.run('Viewer', 'read_transactions');

    // --- Analyst permissions (superset of Viewer) ---
    assignPermission.run('Analyst', 'read_transactions');
    assignPermission.run('Analyst', 'read_analytics');
    assignPermission.run('Analyst', 'export_data');

    // --- Admin permissions (superset of Analyst) ---
    assignPermission.run('Admin', 'read_transactions');
    assignPermission.run('Admin', 'read_analytics');
    assignPermission.run('Admin', 'export_data');
    assignPermission.run('Admin', 'create_transaction');
    assignPermission.run('Admin', 'update_transaction');
    assignPermission.run('Admin', 'delete_transaction');
    assignPermission.run('Admin', 'manage_users');
    assignPermission.run('Admin', 'manage_roles');
  });

  seed();
}

export const name = '006_seed_default_roles_permissions';
