/**
 * Brechtwahl Backend - Auth-Modul
 * 
 * JWT-Authentifizierung und Admin-Code-Prüfung
 */

const jwt = require('jsonwebtoken');

// JWT Secret aus Umgebungsvariable
const JWT_SECRET = process.env.JWT_SECRET || 'brechtwahl-dev-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * JWT-Token generieren
 * @param {Object} payload - Daten die im Token gespeichert werden (user_id, email)
 * @returns {string} JWT Token
 */
function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * JWT-Token verifizieren
 * @param {string} token - JWT Token
 * @returns {Object|null} Decoded payload oder null bei Fehler
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Middleware: Auth Required
 * Prüft ob ein gültiger JWT-Token im Authorization-Header vorhanden ist
 */
function authRequired(req, res, next) {
  const authHeader = req.headers.authorization;
  
  // Header prüfen
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'Nicht authentifiziert',
      message: 'Bitte melde dich an' 
    });
  }

  // Token extrahieren
  const token = authHeader.split(' ')[1];
  
  // Token verifizieren
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ 
      error: 'Token ungültig',
      message: 'Bitte melde dich erneut an' 
    });
  }

  // User-Daten an Request anhängen
  req.user = decoded;
  next();
}

/**
 * Middleware: Admin Required
 * Prüft ob der X-Admin-Code Header korrekt ist
 */
function adminRequired(req, res, next) {
  const adminCode = req.headers['x-admin-code'];
  const expectedCode = process.env.ADMIN_CODE;

  // Kein Admin-Code in .env konfiguriert
  if (!expectedCode) {
    return res.status(500).json({ 
      error: 'Server-Konfigurationsfehler',
      message: 'ADMIN_CODE nicht konfiguriert' 
    });
  }

  // Admin-Code prüfen
  if (!adminCode || adminCode !== expectedCode) {
    return res.status(401).json({ 
      error: 'Nicht autorisiert',
      message: 'Ungültiger Admin-Code' 
    });
  }

  next();
}

/**
 * E-Mail-Validierung für Brecht-Schulen
 * Format: vorname.nachname@brecht-schulen.de
 */
function isValidSchoolEmail(email) {
  // Muss auf @brecht-schulen.de enden
  // Muss mindestens einen Punkt vor @ haben (Vorname.Nachname)
  const regex = /^[a-zA-ZäöüÄÖÜß]+\.[a-zA-ZäöüÄÖÜß]+@brecht-schulen\.de$/i;
  return regex.test(email.trim());
}

module.exports = {
  generateToken,
  verifyToken,
  authRequired,
  adminRequired,
  isValidSchoolEmail,
  JWT_SECRET,
  JWT_EXPIRES_IN
};
