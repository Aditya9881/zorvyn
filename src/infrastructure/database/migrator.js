/**
 * Migration Runner
 *
 * Runs all migrations in order, tracking which have been applied
 * in a _migrations table. Idempotent — safe to run multiple times.
 *
 * Usage:
 *   node src/infrastructure/database/migrator.js
 *   OR
 *   import { runMigrations } from './migrator.js'
 */

import { getDatabase } from './connection.js';

// Import all migrations in order
import * as m001 from './migrations/001_create_users.js';
import * as m002 from './migrations/002_create_roles.js';
import * as m003 from './migrations/003_create_permissions.js';
import * as m004 from './migrations/004_create_user_roles.js';
import * as m005 from './migrations/005_create_role_permissions.js';
import * as m006 from './migrations/006_seed_default_roles_permissions.js';
import * as m007 from './migrations/007_create_transactions.js';
import * as m008 from './migrations/008_create_audit_logs.js';
import * as m009 from './migrations/009_create_idempotent_requests.js';
import * as m010 from './migrations/010_create_budgets.js';

const migrations = [m001, m002, m003, m004, m005, m006, m007, m008, m009, m010];

/**
 * Ensures the _migrations tracking table exists.
 * @param {import('better-sqlite3').Database} db
 */
function ensureMigrationsTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL UNIQUE,
      applied_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

/**
 * Runs all pending migrations in order.
 * @param {import('better-sqlite3').Database} [db] - Optional db instance (for testing)
 */
export function runMigrations(db) {
  const database = db || getDatabase();
  ensureMigrationsTable(database);

  const applied = new Set(
    database
      .prepare('SELECT name FROM _migrations')
      .all()
      .map((row) => row.name)
  );

  const insertMigration = database.prepare(
    'INSERT INTO _migrations (name) VALUES (?)'
  );

  let count = 0;

  for (const migration of migrations) {
    if (applied.has(migration.name)) {
      continue;
    }

    console.log(`  ▸ Running migration: ${migration.name}`);
    migration.up(database);
    insertMigration.run(migration.name);
    count++;
  }

  if (count === 0) {
    console.log('  ✓ All migrations already applied.');
  } else {
    console.log(`  ✓ Applied ${count} migration(s).`);
  }

  return count;
}

// Allow running directly: node src/infrastructure/database/migrator.js
const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith('migrator.js') ||
    process.argv[1].includes('migrator'));

if (isDirectRun) {
  console.log('🗄️  Zorvyn Database Migration');
  console.log('─'.repeat(40));
  runMigrations();
  console.log('─'.repeat(40));
  console.log('Done.');
}
