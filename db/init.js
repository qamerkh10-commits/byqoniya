// db/init.js
// إنشاء الاتصال بقاعدة البيانات وتجهيز الجداول لو مش موجودة

const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, 'app.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user', -- 'user' | 'admin'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,      -- اسم فريد يُستخدم في الرابط
  title TEXT NOT NULL,            -- العنوان الظاهر في القائمة الجانبية
  icon TEXT DEFAULT '📄',
  filename TEXT NOT NULL,         -- اسم الملف داخل مجلد content
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS sessions (
  sid TEXT PRIMARY KEY,
  sess TEXT NOT NULL,
  expire INTEGER NOT NULL
);
`);

module.exports = db;
