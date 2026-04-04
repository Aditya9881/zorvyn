import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import config from '../../config/index.js';

let db = null;

/**
 * Returns a singleton SQLite database connection.
 * Creates the data directory if it doesn't exist.
 * Enables WAL mode for concurrent read performance.
 *
 * @param {string} [dbPath] - Override path (used in tests)
 * @returns {import('better-sqlite3').Database}
 */
export function getDatabase(dbPath) {
  if (db) return db;

  const resolvedPath = dbPath || config.db.path;
  const dir = path.dirname(resolvedPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(resolvedPath);

  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL');
  // Enforce foreign key constraints
  db.pragma('foreign_keys = ON');

  return db;
}

/**
 * Closes the database connection and resets the singleton.
 * Used primarily in tests for clean teardown.
 */
export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Creates a fresh in-memory database for testing.
 * @returns {import('better-sqlite3').Database}
 */
export function createTestDatabase() {
  const testDb = new Database(':memory:');
  testDb.pragma('journal_mode = WAL');
  testDb.pragma('foreign_keys = ON');
  return testDb;
}
