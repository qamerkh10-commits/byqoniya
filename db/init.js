// db/init.js
// إنشاء الاتصال بقاعدة البيانات وتجهيز الجداول لو مش موجودة (مع ترقية آمنة للجداول القديمة)

const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, 'app.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',        -- 'user' | 'admin'
  google_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  icon TEXT DEFAULT '📄',
  filename TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS memorization_items (
  id INTEGER PRIMARY KEY,          -- رقم البيت (1-34)
  title TEXT NOT NULL,             -- المصطلح الأساسي في البيت
  text TEXT NOT NULL               -- نص البيت كاملاً
);

CREATE TABLE IF NOT EXISTS memorization_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  item_id INTEGER NOT NULL,
  scheduled_date TEXT,             -- التاريخ اللي الطالب حدده لنفسه
  memorized INTEGER NOT NULL DEFAULT 0,
  memorized_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, item_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES memorization_items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sessions (
  sid TEXT PRIMARY KEY,
  sess TEXT NOT NULL,
  expire INTEGER NOT NULL
);
`);

// ---- ترقية آمنة لقاعدة بيانات قديمة كانت شغالة بنظام username بدل email ----
function columnExists(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
}

try {
  if (columnExists('users', 'username') && !columnExists('users', 'name')) {
    db.exec(`ALTER TABLE users RENAME COLUMN username TO name`);
  }
  if (!columnExists('users', 'email')) {
    db.exec(`ALTER TABLE users ADD COLUMN email TEXT`);
  }
  if (!columnExists('users', 'google_id')) {
    db.exec(`ALTER TABLE users ADD COLUMN google_id TEXT`);
  }
  if (!columnExists('pages', 'description')) {
    db.exec(`ALTER TABLE pages ADD COLUMN description TEXT DEFAULT ''`);
  }
  if (!columnExists('users', 'last_login_at')) {
    db.exec(`ALTER TABLE users ADD COLUMN last_login_at TEXT`);
  }
  if (!columnExists('users', 'last_active_at')) {
    db.exec(`ALTER TABLE users ADD COLUMN last_active_at TEXT`);
  }
} catch (e) {
  console.warn('تنبيه أثناء ترقية قاعدة البيانات:', e.message);
}

module.exports = db;
