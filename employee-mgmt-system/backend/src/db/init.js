const path = require("path");
const fs = require("fs");
const { DatabaseSync } = require("node:sqlite");

const DB_PATH = process.env.DB_PATH || "./data/employee_mgmt.db";
const resolvedPath = path.isAbsolute(DB_PATH) ? DB_PATH : path.join(__dirname, "..", "..", DB_PATH);

// Ensure the data directory exists
const dataDir = path.dirname(resolvedPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new DatabaseSync(resolvedPath);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

/**
 * node:sqlite's DatabaseSync has no built-in `.transaction()` helper
 * (unlike better-sqlite3), so we provide a small equivalent used by
 * routes that need multi-statement atomicity (e.g. creating a user +
 * employee row together).
 */
db.runInTransaction = function runInTransaction(fn) {
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
};

function initSchema() {
  db.exec(`
    -- ROLES are fixed enum-like values enforced at the app layer: 'admin', 'manager', 'employee'

    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin','manager','employee')),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      full_name TEXT NOT NULL,
      designation TEXT,
      department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
      manager_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
      joining_date TEXT NOT NULL,
      employment_status TEXT NOT NULL DEFAULT 'active' CHECK (employment_status IN ('active','inactive')),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      check_in TEXT,
      check_out TEXT,
      status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present','absent','half_day','on_leave')),
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(employee_id, date)
    );

    CREATE TABLE IF NOT EXISTS leave_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      leave_type TEXT NOT NULL CHECK (leave_type IN ('sick','casual','earned','unpaid')),
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
      reviewed_by INTEGER REFERENCES employees(id) ON DELETE SET NULL,
      reviewed_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department_id);
    CREATE INDEX IF NOT EXISTS idx_employees_manager ON employees(manager_id);
    CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON attendance(employee_id, date);
    CREATE INDEX IF NOT EXISTS idx_leave_employee ON leave_requests(employee_id);
    CREATE INDEX IF NOT EXISTS idx_leave_status ON leave_requests(status);
  `);
}

initSchema();

module.exports = db;
