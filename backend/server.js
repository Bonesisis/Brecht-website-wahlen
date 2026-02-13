/**
 * Brechtwahl Backend - Server
 * 
 * Express-Server mit REST-API für die Abstimmungsplattform
 * 
 * Endpoints:
 * - POST /api/register     - Neuen Account erstellen
 * - POST /api/login        - Einloggen und Token erhalten
 * - GET  /api/polls        - Alle Abstimmungen abrufen
 * - GET  /api/polls/:id    - Einzelne Abstimmung abrufen
 * - POST /api/vote         - Abstimmen (Auth required)
 * - GET  /api/results      - Ergebnisse abrufen
 * 
 * Admin-Endpoints (X-Admin-Code Header required):
 * - POST   /api/admin/polls      - Neue Abstimmung erstellen
 * - PATCH  /api/admin/polls/:id  - Abstimmung aktualisieren
 * - DELETE /api/admin/polls/:id  - Abstimmung löschen
 * - GET    /api/admin/results    - Ergebnisse abrufen (Admin)
 * 
 * Test-Endpoints (isoliert, nur für deine Test-Seite):
 * - POST /api/test/vote          - Test-Stimme abgeben
 * - GET  /api/test/votes         - Test-Ergebnisse abrufen
 */

require('dotenv').config();

const express = require('express');
const app = express();
const cors = require('cors');
const path = require('path');
const auth = require('./auth');
const db = require('./db');
const mail = require('./mail');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Request-Logging (einfach)
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Hilfsfunktion für Verifizierungscode
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ==================== Auth Endpoints ====================

/**
 * POST /api/register
 * Neuen Account erstellen (noch nicht verifiziert)
 */
app.post('/api/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validierung
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Fehlende Daten',
        message: 'E-Mail und Passwort sind erforderlich' 
      });
    }

    // E-Mail-Format prüfen (nur @brecht-schule.hamburg)
    if (!auth.isValidSchoolEmail(email)) {
      return res.status(400).json({ 
        error: 'Ungültige E-Mail',
        message: 'Bitte nutze deine Schul-E-Mail (vorname.nachname@brecht-schule.hamburg oder nachname@brecht-schule.hamburg)' 
      });
    }

    // Passwort-Länge prüfen
    if (password.length < 4) {
      return res.status(400).json({ 
        error: 'Passwort zu kurz',
        message: 'Das Passwort muss mindestens 4 Zeichen haben' 
      });
    }

    // Prüfen ob E-Mail bereits existiert
    const existingUser = db.findUserByEmail(email.toLowerCase().trim());
    if (existingUser) {
      // Falls nicht verifiziert, neuen Code senden
      if (existingUser.verified === 0) {
        const newCode = generateVerificationCode();
        db.updateVerificationCode(email.toLowerCase().trim(), newCode);
        
        // E-Mail mit Code senden
        await mail.sendVerificationEmail(email, newCode);
        
        return res.status(200).json({ 
          message: 'Neuer Bestätigungscode wurde an deine E-Mail gesendet',
          requiresVerification: true,
          email: email.toLowerCase().trim()
        });
      }
      return res.status(409).json({ 
        error: 'E-Mail bereits registriert',
        message: 'Diese E-Mail ist bereits registriert. Bitte melde dich an.' 
      });
    }

    // Bestätigungscode generieren
    const verificationCode = generateVerificationCode();

    // Passwort hashen
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // User erstellen (noch nicht verifiziert)
    const userId = db.createUser(email.toLowerCase().trim(), passwordHash, verificationCode);

    // E-Mail mit Bestätigungscode senden
    await mail.sendVerificationEmail(email, verificationCode);

    res.status(201).json({ 
      message: 'Registrierung erfolgreich. Bitte prüfe deine E-Mails für den Bestätigungscode.',
      requiresVerification: true,
      email: email.toLowerCase().trim()
    });

  } catch (error) {
    console.error('Register-Fehler:', error);
    res.status(500).json({ 
      error: 'Serverfehler',
      message: 'Registrierung fehlgeschlagen' 
    });
  }
});

/**
 * POST /api/verify
 * E-Mail mit Code bestätigen
 */
app.post('/api/verify', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ 
        error: 'Fehlende Daten',
        message: 'E-Mail und Code sind erforderlich' 
      });
    }

    const result = db.verifyUser(email.toLowerCase().trim(), code);
    
    if (!result.success) {
      return res.status(400).json({ 
        error: 'Verifizierung fehlgeschlagen',
        message: result.message 
      });
    }

    // Token generieren
    const token = auth.generateToken({ 
      user_id: result.user.id, 
      email: result.user.email 
    });

    res.json({ 
      message: 'E-Mail erfolgreich bestätigt',
      token,
      user: { id: result.user.id, email: result.user.email }
    });

  } catch (error) {
    console.error('Verify-Fehler:', error);
    res.status(500).json({ 
      error: 'Serverfehler',
      message: 'Verifizierung fehlgeschlagen' 
    });
  }
});

/**
 * POST /api/login
 * Einloggen und Token erhalten
 */
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validierung
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Fehlende Daten',
        message: 'E-Mail und Passwort sind erforderlich' 
      });
    }

    // User suchen
    const user = db.findUserByEmail(email.toLowerCase().trim());
    if (!user) {
      return res.status(401).json({ 
        error: 'Login fehlgeschlagen',
        message: 'E-Mail oder Passwort falsch' 
      });
    }

    // Prüfen ob verifiziert
    if (user.verified !== 1) {
      // Neuen Code senden
      const newCode = generateVerificationCode();
      db.updateVerificationCode(email.toLowerCase().trim(), newCode);
      
      console.log('');
      console.log('═══════════════════════════════════════════════');
      console.log(`  BESTÄTIGUNGSCODE für ${email}`);
      console.log(`  Code: ${newCode}`);
      console.log('═══════════════════════════════════════════════');
      console.log('');
      
      return res.status(403).json({ 
        error: 'Nicht verifiziert',
        message: 'Bitte bestätige zuerst deine E-Mail. Ein neuer Code wurde gesendet.',
        requiresVerification: true,
        email: user.email
      });
    }

    // Passwort prüfen
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      return res.status(401).json({ 
        error: 'Login fehlgeschlagen',
        message: 'E-Mail oder Passwort falsch' 
      });
    }

    // Token generieren
    const token = auth.generateToken({ 
      user_id: user.id, 
      email: user.email 
    });

    res.json({ 
      message: 'Login erfolgreich',
      token,
      user: { id: user.id, email: user.email }
    });

  } catch (error) {
    console.error('Login-Fehler:', error);
    res.status(500).json({ 
      error: 'Serverfehler',
      message: 'Login fehlgeschlagen' 
    });
  }
});

// ==================== Password Reset ====================

/**
 * POST /api/forgot-password
 * Reset-Code anfordern
 */
app.post('/api/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ 
        error: 'Fehlende Daten',
        message: 'E-Mail ist erforderlich' 
      });
    }

    // User suchen
    const user = db.findUserByEmail(email.toLowerCase().trim());
    if (!user) {
      // Aus Sicherheitsgründen gleiche Antwort wie bei Erfolg
      return res.json({ 
        message: 'Falls ein Account mit dieser E-Mail existiert, wurde ein Reset-Code gesendet.'
      });
    }

    // Reset-Code generieren
    const resetCode = generateVerificationCode();
    db.updateVerificationCode(email.toLowerCase().trim(), resetCode);

    // E-Mail senden
    await mail.sendPasswordResetEmail(email, resetCode);

    res.json({ 
      message: 'Falls ein Account mit dieser E-Mail existiert, wurde ein Reset-Code gesendet.',
      email: email.toLowerCase().trim()
    });

  } catch (error) {
    console.error('Forgot-Password-Fehler:', error);
    res.status(500).json({ 
      error: 'Serverfehler',
      message: 'Anfrage fehlgeschlagen' 
    });
  }
});

/**
 * POST /api/reset-password
 * Passwort mit Code zurücksetzen
 */
app.post('/api/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({ 
        error: 'Fehlende Daten',
        message: 'E-Mail, Code und neues Passwort sind erforderlich' 
      });
    }

    if (newPassword.length < 4) {
      return res.status(400).json({ 
        error: 'Passwort zu kurz',
        message: 'Das Passwort muss mindestens 4 Zeichen haben' 
      });
    }

    // User suchen
    const user = db.findUserByEmail(email.toLowerCase().trim());
    if (!user) {
      return res.status(400).json({ 
        error: 'Ungültig',
        message: 'E-Mail oder Code ungültig' 
      });
    }

    // Code prüfen
    if (String(user.verification_code) !== String(code).trim()) {
      return res.status(400).json({ 
        error: 'Ungültiger Code',
        message: 'Der eingegebene Code ist falsch' 
      });
    }

    // Neues Passwort hashen und speichern
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    db.updatePassword(email.toLowerCase().trim(), passwordHash);

    // Code löschen
    db.updateVerificationCode(email.toLowerCase().trim(), null);

    res.json({ 
      message: 'Passwort erfolgreich geändert. Du kannst dich jetzt anmelden.'
    });

  } catch (error) {
    console.error('Reset-Password-Fehler:', error);
    res.status(500).json({ 
      error: 'Serverfehler',
      message: 'Passwort-Reset fehlgeschlagen' 
    });
  }
});

// ==================== Poll Endpoints ====================

/**
 * GET /api/polls
 * Alle Abstimmungen abrufen
 */
app.get('/api/polls', (req, res) => {
  try {
    const polls = db.getAllPolls();
    
    // active von Integer zu Boolean konvertieren
    const formattedPolls = polls.map(poll => ({
      ...poll,
      active: poll.active === 1
    }));

    res.json(formattedPolls);
  } catch (error) {
    console.error('Polls-Fehler:', error);
    res.status(500).json({ 
      error: 'Serverfehler',
      message: 'Abstimmungen konnten nicht geladen werden' 
    });
  }
});

/**
 * GET /api/polls/:id
 * Einzelne Abstimmung abrufen
 */
app.get('/api/polls/:id', (req, res) => {
  try {
    const poll = db.getPollById(req.params.id);
    
    if (!poll) {
      return res.status(404).json({ 
        error: 'Nicht gefunden',
        message: 'Abstimmung existiert nicht' 
      });
    }

    res.json({
      ...poll,
      active: poll.active === 1
    });
  } catch (error) {
    console.error('Poll-Fehler:', error);
    res.status(500).json({ 
      error: 'Serverfehler',
      message: 'Abstimmung konnte nicht geladen werden' 
    });
  }
});

// ==================== Voting Endpoints ====================

/**
 * POST /api/vote
 * Abstimmen (Auth required)
 */
app.post('/api/vote', auth.authRequired, (req, res) => {
  try {
    const { poll_id, choice } = req.body;
    const userId = req.user.user_id;

    // Validierung
    if (!poll_id || !choice) {
      return res.status(400).json({ 
        error: 'Fehlende Daten',
        message: 'poll_id und choice sind erforderlich' 
      });
    }

    if (!['yes', 'no'].includes(choice)) {
      return res.status(400).json({ 
        error: 'Ungültige Auswahl',
        message: 'choice muss "yes" oder "no" sein' 
      });
    }

    // Poll prüfen
    const poll = db.getPollById(poll_id);
    if (!poll) {
      return res.status(404).json({ 
        error: 'Nicht gefunden',
        message: 'Abstimmung existiert nicht' 
      });
    }

    if (poll.active !== 1) {
      return res.status(400).json({ 
        error: 'Abstimmung geschlossen',
        message: 'Diese Abstimmung ist nicht mehr aktiv' 
      });
    }

    // Prüfen ob User bereits abgestimmt hat
    if (db.hasUserVoted(poll_id, userId)) {
      return res.status(409).json({ 
        error: 'Bereits abgestimmt',
        message: 'Du hast bereits an dieser Abstimmung teilgenommen' 
      });
    }

    // Vote speichern
    db.createVote(poll_id, userId, choice);

    res.status(201).json({ 
      message: 'Stimme erfolgreich abgegeben',
      choice 
    });

  } catch (error) {
    console.error('Vote-Fehler:', error);
    res.status(500).json({ 
      error: 'Serverfehler',
      message: 'Abstimmung fehlgeschlagen' 
    });
  }
});

/**
 * GET /api/results
 * Ergebnisse für eine Abstimmung abrufen
 */
app.get('/api/results', (req, res) => {
  try {
    const { poll_id } = req.query;

    if (!poll_id) {
      return res.status(400).json({ 
        error: 'Fehlende Daten',
        message: 'poll_id ist erforderlich' 
      });
    }

    // Poll prüfen
    const poll = db.getPollById(poll_id);
    if (!poll) {
      return res.status(404).json({ 
        error: 'Nicht gefunden',
        message: 'Abstimmung existiert nicht' 
      });
    }

    // Ergebnisse abrufen
    const results = db.getResults(poll_id);

    res.json({
      poll_id,
      total: results.total || 0,
      yes: results.yes || 0,
      no: results.no || 0
    });

  } catch (error) {
    console.error('Results-Fehler:', error);
    res.status(500).json({ 
      error: 'Serverfehler',
      message: 'Ergebnisse konnten nicht geladen werden' 
    });
  }
});

/**
 * GET /api/hasvoted
 * Prüft ob der User bereits abgestimmt hat
 */
app.get('/api/hasvoted', auth.authRequired, (req, res) => {
  try {
    const { poll_id } = req.query;
    const userId = req.user.user_id;

    if (!poll_id) {
      return res.status(400).json({ 
        error: 'Fehlende Daten',
        message: 'poll_id ist erforderlich' 
      });
    }

    const hasVoted = db.hasUserVoted(poll_id, userId);

    res.json({ hasVoted });

  } catch (error) {
    console.error('HasVoted-Fehler:', error);
    res.status(500).json({ 
      error: 'Serverfehler',
      message: 'Prüfung fehlgeschlagen' 
    });
  }
});

// ==================== Test-Poll Endpoints (ohne Auth) ====================

/**
 * GET /api/test-poll/:id
 * Test-Abstimmung abrufen (keine Auth nötig)
 */
app.get('/api/test-poll/:id', (req, res) => {
  try {
    const poll = db.getPollById(req.params.id);
    
    if (!poll || poll.is_test !== 1) {
      return res.status(404).json({ 
        error: 'Nicht gefunden',
        message: 'Test-Abstimmung existiert nicht' 
      });
    }

    res.json({
      ...poll,
      active: poll.active === 1,
      is_test: true
    });
  } catch (error) {
    console.error('Test-Poll-Fehler:', error);
    res.status(500).json({ 
      error: 'Serverfehler',
      message: 'Test-Abstimmung konnte nicht geladen werden' 
    });
  }
});

/**
 * POST /api/test-vote
 * Bei Test-Abstimmung abstimmen (keine Auth, Cookie-basiert)
 */
app.post('/api/test-vote', (req, res) => {
  try {
    const { poll_id, choice, voter_token } = req.body;

    // Validierung
    if (!poll_id || !choice || !voter_token) {
      return res.status(400).json({ 
        error: 'Fehlende Daten',
        message: 'poll_id, choice und voter_token sind erforderlich' 
      });
    }

    if (!['yes', 'no'].includes(choice)) {
      return res.status(400).json({ 
        error: 'Ungültige Wahl',
        message: 'choice muss "yes" oder "no" sein' 
      });
    }

    // Poll prüfen
    const poll = db.getPollById(poll_id);
    if (!poll || poll.is_test !== 1) {
      return res.status(404).json({ 
        error: 'Nicht gefunden',
        message: 'Test-Abstimmung existiert nicht' 
      });
    }

    if (poll.active !== 1) {
      return res.status(400).json({ 
        error: 'Geschlossen',
        message: 'Diese Abstimmung ist beendet' 
      });
    }

    // Prüfen ob bereits abgestimmt
    if (db.hasTestVoted(poll_id, voter_token)) {
      return res.status(400).json({ 
        error: 'Bereits abgestimmt',
        message: 'Du hast bereits abgestimmt' 
      });
    }

    // Stimme speichern
    db.createTestVote(poll_id, voter_token, choice);

    res.json({
      message: 'Stimme erfolgreich abgegeben',
      choice
    });

  } catch (error) {
    console.error('Test-Vote-Fehler:', error);
    res.status(500).json({ 
      error: 'Serverfehler',
      message: 'Abstimmung fehlgeschlagen' 
    });
  }
});

/**
 * GET /api/test-results
 * Ergebnisse für Test-Abstimmung abrufen
 */
app.get('/api/test-results', (req, res) => {
  try {
    const { poll_id } = req.query;

    if (!poll_id) {
      return res.status(400).json({ 
        error: 'Fehlende Daten',
        message: 'poll_id ist erforderlich' 
      });
    }

    const poll = db.getPollById(poll_id);
    if (!poll || poll.is_test !== 1) {
      return res.status(404).json({ 
        error: 'Nicht gefunden',
        message: 'Test-Abstimmung existiert nicht' 
      });
    }

    const results = db.getTestResults(poll_id);

    res.json({
      poll_id,
      total: results.total || 0,
      yes: results.yes || 0,
      no: results.no || 0
    });

  } catch (error) {
    console.error('Test-Results-Fehler:', error);
    res.status(500).json({ 
      error: 'Serverfehler',
      message: 'Ergebnisse konnten nicht geladen werden' 
    });
  }
});

/**
 * GET /api/test-hasvoted
 * Prüfen ob bei Test-Abstimmung bereits abgestimmt
 */
app.get('/api/test-hasvoted', (req, res) => {
  try {
    const { poll_id, voter_token } = req.query;

    if (!poll_id || !voter_token) {
      return res.status(400).json({ 
        error: 'Fehlende Daten',
        message: 'poll_id und voter_token sind erforderlich' 
      });
    }

    const hasVoted = db.hasTestVoted(poll_id, voter_token);

    res.json({ hasVoted });

  } catch (error) {
    console.error('Test-HasVoted-Fehler:', error);
    res.status(500).json({ 
      error: 'Serverfehler',
      message: 'Prüfung fehlgeschlagen' 
    });
  }
});

// ==================== Admin Endpoints ====================

/**
 * GET /api/admin/test-polls
 * Alle Test-Abstimmungen abrufen (Admin)
 */
app.get('/api/admin/test-polls', auth.adminRequired, (req, res) => {
  try {
    const polls = db.getTestPolls();
    
    const formattedPolls = polls.map(poll => ({
      ...poll,
      active: poll.active === 1,
      is_test: poll.is_test === 1
    }));

    res.json(formattedPolls);
  } catch (error) {
    console.error('Admin Test-Polls-Fehler:', error);
    res.status(500).json({ 
      error: 'Serverfehler',
      message: 'Test-Abstimmungen konnten nicht geladen werden' 
    });
  }
});

/**
 * POST /api/admin/polls
 * Neue Abstimmung erstellen (Admin)
 */
app.post('/api/admin/polls', auth.adminRequired, (req, res) => {
  try {
    const { title, question, active = true, is_test = false } = req.body;

    if (!title || title.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Fehlende Daten',
        message: 'Titel ist erforderlich' 
      });
    }

    const pollId = uuidv4();
    db.createPoll(pollId, title.trim(), question ? question.trim() : null, active, is_test);

    const poll = db.getPollById(pollId);

    res.status(201).json({
      message: 'Abstimmung erstellt',
      poll: {
        ...poll,
        active: poll.active === 1,
        is_test: poll.is_test === 1
      }
    });

  } catch (error) {
    console.error('Admin Create-Fehler:', error);
    res.status(500).json({ 
      error: 'Serverfehler',
      message: 'Abstimmung konnte nicht erstellt werden' 
    });
  }
});

/**
 * PATCH /api/admin/polls/:id
 * Abstimmung aktualisieren (Admin)
 */
app.patch('/api/admin/polls/:id', auth.adminRequired, (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;

    // Poll prüfen
    const poll = db.getPollById(id);
    if (!poll) {
      return res.status(404).json({ 
        error: 'Nicht gefunden',
        message: 'Abstimmung existiert nicht' 
      });
    }

    if (typeof active !== 'boolean') {
      return res.status(400).json({ 
        error: 'Ungültige Daten',
        message: 'active muss true oder false sein' 
      });
    }

    // Aktualisieren
    db.updatePoll(id, active);
    
    const updatedPoll = db.getPollById(id);

    res.json({
      message: 'Abstimmung aktualisiert',
      poll: {
        ...updatedPoll,
        active: updatedPoll.active === 1
      }
    });

  } catch (error) {
    console.error('Admin Update-Fehler:', error);
    res.status(500).json({ 
      error: 'Serverfehler',
      message: 'Abstimmung konnte nicht aktualisiert werden' 
    });
  }
});

/**
 * DELETE /api/admin/polls/:id
 * Abstimmung löschen (Admin)
 */
app.delete('/api/admin/polls/:id', auth.adminRequired, (req, res) => {
  try {
    const { id } = req.params;

    // Poll prüfen
    const poll = db.getPollById(id);
    if (!poll) {
      return res.status(404).json({ 
        error: 'Nicht gefunden',
        message: 'Abstimmung existiert nicht' 
      });
    }

    // Votes und Poll löschen
    db.resetVotes(id);
    db.deletePoll(id);

    res.json({ 
      message: 'Abstimmung gelöscht',
      id 
    });

  } catch (error) {
    console.error('Admin Delete-Fehler:', error);
    res.status(500).json({ 
      error: 'Serverfehler',
      message: 'Abstimmung konnte nicht gelöscht werden' 
    });
  }
});

/**
 * GET /api/admin/results
 * Ergebnisse abrufen (Admin)
 */
app.get('/api/admin/results', auth.adminRequired, (req, res) => {
  try {
    const { poll_id } = req.query;

    if (!poll_id) {
      return res.status(400).json({ 
        error: 'Fehlende Daten',
        message: 'poll_id ist erforderlich' 
      });
    }

    const poll = db.getPollById(poll_id);
    if (!poll) {
      return res.status(404).json({ 
        error: 'Nicht gefunden',
        message: 'Abstimmung existiert nicht' 
      });
    }

    const results = db.getResults(poll_id);

    res.json({
      poll_id,
      poll_title: poll.title,
      total: results.total || 0,
      yes: results.yes || 0,
      no: results.no || 0
    });

  } catch (error) {
    console.error('Admin Results-Fehler:', error);
    res.status(500).json({ 
      error: 'Serverfehler',
      message: 'Ergebnisse konnten nicht geladen werden' 
    });
  }
});

// ==================== Health Check ====================

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// ==================== 404 Handler ====================

app.use('/api/*', (req, res) => {
  res.status(404).json({ 
    error: 'Nicht gefunden',
    message: 'Dieser API-Endpoint existiert nicht' 
  });
});

// ==================== Server starten ====================

const PORT = process.env.PORT || 3000;

// Datenbank initialisieren und Server starten
db.initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log('');
    console.log('╔════════════════════════════════════════════╗');
    console.log('║       Brechtwahl Backend gestartet         ║');
    console.log('╚════════════════════════════════════════════╝');
    console.log('');
    console.log(`✓ Server läuft auf Port ${PORT}`);
    console.log(`✓ API-Basis: http://localhost:${PORT}/api`);
    console.log('');
  });
}).catch(err => {
  console.error('Fehler beim Starten:', err);
  process.exit(1);
});
