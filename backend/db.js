/**
 * Brechtwahl Backend - Datenbank-Modul
 * 
 * SQLite-Datenbank mit better-sqlite3 (synchron, schnell, portabel)
 */

const Database = require('better-sqlite3');
const path = require('path');

// Datenbank-Datei im backend-Ordner
const DB_PATH = path.join(__dirname, 'db.sqlite');

// Datenbank-Verbindung erstellen
const db = new Database(DB_PATH);

// WAL-Modus für bessere Performance
db.pragma('journal_mode = WAL');

/**
 * Datenbank-Schema initialisieren
 */
function initDatabase() {
  // Users-Tabelle
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    )
  `);

  // Polls-Tabelle
  db.exec(`
    CREATE TABLE IF NOT EXISTS polls (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    )
  `);

  // Votes-Tabelle mit Unique Constraint (1 Vote pro User pro Poll)
  db.exec(`
    CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      poll_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      choice TEXT NOT NULL CHECK(choice IN ('yes', 'no')),
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      UNIQUE(poll_id, user_id),
      FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Index für schnellere Abfragen
  db.exec(`CREATE INDEX IF NOT EXISTS idx_votes_poll ON votes(poll_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_votes_user ON votes(user_id)`);

  console.log('✓ Datenbank initialisiert');
}

// ==================== User-Funktionen ====================

/**
 * Neuen User erstellen
 */
const createUser = db.prepare(`
  INSERT INTO users (email, password_hash) VALUES (?, ?)
`);

/**
 * User per Email finden
 */
const findUserByEmail = db.prepare(`
  SELECT * FROM users WHERE email = ?
`);

/**
 * User per ID finden
 */
const findUserById = db.prepare(`
  SELECT id, email, created_at FROM users WHERE id = ?
`);

// ==================== Poll-Funktionen ====================

/**
 * Alle Polls abrufen (nur id, title, active)
 */
const getAllPolls = db.prepare(`
  SELECT id, title, active FROM polls ORDER BY created_at DESC
`);

/**
 * Einzelnen Poll per ID abrufen
 */
const getPollById = db.prepare(`
  SELECT id, title, active, created_at FROM polls WHERE id = ?
`);

/**
 * Neuen Poll erstellen
 */
const createPoll = db.prepare(`
  INSERT INTO polls (id, title, active) VALUES (?, ?, ?)
`);

/**
 * Poll aktualisieren (active status)
 */
const updatePoll = db.prepare(`
  UPDATE polls SET active = ? WHERE id = ?
`);

/**
 * Poll löschen
 */
const deletePoll = db.prepare(`
  DELETE FROM polls WHERE id = ?
`);

// ==================== Vote-Funktionen ====================

/**
 * Vote abgeben
 */
const createVote = db.prepare(`
  INSERT INTO votes (poll_id, user_id, choice) VALUES (?, ?, ?)
`);

/**
 * Prüfen ob User bereits gevoted hat
 */
const hasUserVoted = db.prepare(`
  SELECT id FROM votes WHERE poll_id = ? AND user_id = ?
`);

/**
 * Ergebnisse für einen Poll abrufen
 */
const getResults = db.prepare(`
  SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN choice = 'yes' THEN 1 ELSE 0 END) as yes,
    SUM(CASE WHEN choice = 'no' THEN 1 ELSE 0 END) as no
  FROM votes 
  WHERE poll_id = ?
`);

/**
 * Alle Votes für einen Poll löschen (Admin-Funktion)
 */
const resetVotes = db.prepare(`
  DELETE FROM votes WHERE poll_id = ?
`);

// Exportieren
module.exports = {
  db,
  initDatabase,
  // Users
  createUser,
  findUserByEmail,
  findUserById,
  // Polls
  getAllPolls,
  getPollById,
  createPoll,
  updatePoll,
  deletePoll,
  // Votes
  createVote,
  hasUserVoted,
  getResults,
  resetVotes
};
