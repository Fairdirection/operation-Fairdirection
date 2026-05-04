const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DATABASE_URL 
  ? path.join(__dirname, '..', process.env.DATABASE_URL)
  : path.join(__dirname, '../database.sqlite');

const db = new Database(dbPath);

// Enable foreign keys and optimize for production
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL'); // Better concurrency
db.pragma('synchronous = NORMAL'); // Balance between safety and speed
db.pragma('cache_size = 10000'); // Cache 10,000 pages for faster reads

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS uploads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    report_date DATE,
    total_leads INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    upload_id INTEGER,
    request_creation_date TEXT,
    salesman_name TEXT,
    state TEXT,
    last_action TEXT,
    note TEXT,
    name TEXT,
    email TEXT,
    mobile TEXT,
    unit_type TEXT,
    commercial_unit_type TEXT,
    residential_unit_type TEXT,
    budget TEXT,
    campaign TEXT,
    channel TEXT,
    lead_id TEXT,
    inventory TEXT,
    next_action_date TEXT,
    FOREIGN KEY (upload_id) REFERENCES uploads(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed initial user if not exists
const bcrypt = require('bcryptjs');
const userExists = db.prepare('SELECT * FROM users WHERE username = ?').get('hanan');
if (!userExists) {
  const hashedPassword = bcrypt.hashSync('hanan2001', 10);
  db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('hanan', hashedPassword);
}

module.exports = db;
