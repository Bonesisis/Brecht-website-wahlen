/**
 * Brechtwahl Backend - Datenbank-Modul
 * 
 * SQLite-Datenbank mit sql.js (pure JavaScript, keine native Kompilierung)
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

// Datenbank-Datei im backend-Ordner
const DB_PATH = path.join(__dirname, 'db.sqlite');

// Globale Datenbank-Instanz
let db = null;

/**
 * Datenbank initialisieren (async!)
 */
async function initDatabase() {
  const SQL = await initSqlJs();
  
  // Versuche existierende DB zu laden
  try {
    if (fs.existsSync(DB_PATH)) {
      const fileBuffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(fileBuffer);
      console.log('✓ Existierende Datenbank geladen');
    } else {
      db = new SQL.Database();
      console.log('✓ Neue Datenbank erstellt');
    }
  } catch (error) {
    db = new SQL.Database();
    console.log('✓ Neue Datenbank erstellt (Fehler beim Laden)');
  }

  // Schema erstellen
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      verified INTEGER NOT NULL DEFAULT 0,
      verification_code TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS polls (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      poll_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      choice TEXT NOT NULL CHECK(choice IN ('yes', 'no')),
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      UNIQUE(poll_id, user_id)
    )
  `);

  // Indizes
  db.run(`CREATE INDEX IF NOT EXISTS idx_votes_poll ON votes(poll_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_votes_user ON votes(user_id)`);

  // Speichern
  saveDatabase();
  
  console.log('✓ Datenbank-Schema initialisiert');
  return db;
}

/**
 * Datenbank auf Disk speichern
 */
function saveDatabase() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

/**
 * Datenbank-Instanz abrufen
 */
function getDb() {
  if (!db) throw new Error('Datenbank nicht initialisiert');
  return db;
}

// ==================== User-Funktionen ====================

function createUser(email, passwordHash, verificationCode) {
  const stmt = db.prepare('INSERT INTO users (email, password_hash, verified, verification_code) VALUES (?, ?, 0, ?)');
  stmt.run([email, passwordHash, verificationCode]);
  stmt.free();
  saveDatabase();
  
  // ID des neuen Users abrufen
  const result = db.exec('SELECT last_insert_rowid() as id');
  return result[0].values[0][0];
}

function findUserByEmail(email) {
  const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
  stmt.bind([email]);
  
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

function findUserById(id) {
  const stmt = db.prepare('SELECT id, email, verified, created_at FROM users WHERE id = ?');
  stmt.bind([id]);
  
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

function verifyUser(email, code) {
  // Prüfe ob Code stimmt
  const user = findUserByEmail(email);
  if (!user) return { success: false, message: 'Benutzer nicht gefunden' };
  if (user.verified === 1) return { success: false, message: 'Bereits verifiziert' };
  
  // String-Vergleich (beide als String)
  const storedCode = String(user.verification_code || '');
  const inputCode = String(code || '').trim();
  
  console.log(`Verify: stored="${storedCode}", input="${inputCode}"`);
  
  if (storedCode !== inputCode) {
    return { success: false, message: 'Falscher Code' };
  }
  
  // Verifizieren
  const stmt = db.prepare('UPDATE users SET verified = 1, verification_code = NULL WHERE email = ?');
  stmt.run([email]);
  stmt.free();
  saveDatabase();
  
  return { success: true, user };
}

function updateVerificationCode(email, newCode) {
  const stmt = db.prepare('UPDATE users SET verification_code = ? WHERE email = ?');
  stmt.run([newCode, email]);
  stmt.free();
  saveDatabase();
}

function updatePassword(email, newPasswordHash) {
  const stmt = db.prepare('UPDATE users SET password_hash = ? WHERE email = ?');
  stmt.run([newPasswordHash, email]);
  stmt.free();
  saveDatabase();
}

// ==================== Poll-Funktionen ====================

function getAllPolls() {
  const result = db.exec('SELECT id, title, active FROM polls ORDER BY created_at DESC');
  if (!result.length) return [];
  
  return result[0].values.map(row => ({
    id: row[0],
    title: row[1],
    active: row[2]
  }));
}

function getPollById(id) {
  const stmt = db.prepare('SELECT id, title, active, created_at FROM polls WHERE id = ?');
  stmt.bind([id]);
  
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

function createPoll(id, title, active) {
  const stmt = db.prepare('INSERT INTO polls (id, title, active) VALUES (?, ?, ?)');
  stmt.run([id, title, active ? 1 : 0]);
  stmt.free();
  saveDatabase();
}

function updatePoll(id, active) {
  const stmt = db.prepare('UPDATE polls SET active = ? WHERE id = ?');
  stmt.run([active ? 1 : 0, id]);
  stmt.free();
  saveDatabase();
}

function deletePoll(id) {
  const stmt = db.prepare('DELETE FROM polls WHERE id = ?');
  stmt.run([id]);
  stmt.free();
  saveDatabase();
}

// ==================== Vote-Funktionen ====================

function createVote(pollId, userId, choice) {
  const stmt = db.prepare('INSERT INTO votes (poll_id, user_id, choice) VALUES (?, ?, ?)');
  stmt.run([pollId, userId, choice]);
  stmt.free();
  saveDatabase();
}

function hasUserVoted(pollId, userId) {
  const stmt = db.prepare('SELECT id FROM votes WHERE poll_id = ? AND user_id = ?');
  stmt.bind([pollId, userId]);
  const hasVote = stmt.step();
  stmt.free();
  return hasVote;
}

function getResults(pollId) {
  const stmt = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN choice = 'yes' THEN 1 ELSE 0 END) as yes,
      SUM(CASE WHEN choice = 'no' THEN 1 ELSE 0 END) as no
    FROM votes 
    WHERE poll_id = ?
  `);
  stmt.bind([pollId]);
  
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return {
      total: row.total || 0,
      yes: row.yes || 0,
      no: row.no || 0
    };
  }
  stmt.free();
  return { total: 0, yes: 0, no: 0 };
}

function resetVotes(pollId) {
  const stmt = db.prepare('DELETE FROM votes WHERE poll_id = ?');
  stmt.run([pollId]);
  stmt.free();
  saveDatabase();
}

// Exportieren
module.exports = {
  initDatabase,
  getDb,
  saveDatabase,
  // Users
  createUser,
  findUserByEmail,
  findUserById,
  verifyUser,
  updateVerificationCode,
  updatePassword,
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
