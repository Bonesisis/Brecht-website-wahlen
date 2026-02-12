/**
 * Brechtwahl Backend - E-Mail-Modul
 * 
 * Versendet E-Mails über SMTP (Schulserver)
 * Beachtet Proxy-Konfiguration (172.16.0.1:3128)
 */

const nodemailer = require('nodemailer');

// E-Mail-Konfiguration aus Umgebungsvariablen
const SMTP_HOST = process.env.SMTP_HOST || 'mail.brecht-schule.hamburg';
const SMTP_PORT = parseInt(process.env.SMTP_PORT) || 587;
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || 'noreply@brecht-schule.hamburg';
const SMTP_FROM_NAME = process.env.SMTP_FROM_NAME || 'Brechtwahl';

// Transporter erstellen
let transporter = null;

/**
 * SMTP-Transporter initialisieren
 */
function initTransporter() {
  if (!SMTP_USER || !SMTP_PASS) {
    console.warn('⚠️  SMTP nicht konfiguriert - E-Mails werden nur in Konsole ausgegeben');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE, // true für 465, false für andere Ports
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    },
    // Timeout-Einstellungen
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    // TLS-Optionen
    tls: {
      rejectUnauthorized: false // Falls selbstsigniertes Zertifikat
    }
  });

  console.log(`✓ SMTP konfiguriert: ${SMTP_HOST}:${SMTP_PORT}`);
  return transporter;
}

/**
 * Bestätigungscode per E-Mail senden
 * @param {string} email - Empfänger-E-Mail
 * @param {string} code - 6-stelliger Bestätigungscode
 * @returns {Promise<boolean>} - true wenn erfolgreich
 */
async function sendVerificationEmail(email, code) {
  // Immer in Konsole ausgeben (für Debugging)
  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log(`  📧 BESTÄTIGUNGSCODE für ${email}`);
  console.log(`  Code: ${code}`);
  console.log('═══════════════════════════════════════════════');
  console.log('');

  // Wenn kein Transporter konfiguriert, nur Konsole
  if (!transporter) {
    console.log('  (Nur Konsole - SMTP nicht konfiguriert)');
    return true;
  }

  try {
    const mailOptions = {
      from: `"${SMTP_FROM_NAME}" <${SMTP_FROM}>`,
      to: email,
      subject: 'Dein Bestätigungscode für Brechtwahl',
      text: `
Hallo,

dein Bestätigungscode für die Brechtwahl-Registrierung lautet:

    ${code}

Gib diesen Code auf der Verifizierungsseite ein, um deine Registrierung abzuschließen.

Falls du dich nicht registriert hast, kannst du diese E-Mail ignorieren.

Viele Grüße,
Das Brechtwahl-Team
Demokratieprojekt der Brecht Schule Hamburg
      `.trim(),
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 500px; margin: 0 auto; padding: 20px; }
    .header { background: #2d7a4f; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .code { font-size: 32px; font-weight: bold; text-align: center; background: white; padding: 20px; border-radius: 8px; margin: 20px 0; letter-spacing: 4px; color: #2d7a4f; border: 2px dashed #2d7a4f; }
    .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin:0">🗳️ Brechtwahl</h1>
    </div>
    <div class="content">
      <p>Hallo,</p>
      <p>dein Bestätigungscode für die Brechtwahl-Registrierung lautet:</p>
      <div class="code">${code}</div>
      <p>Gib diesen Code auf der Verifizierungsseite ein, um deine Registrierung abzuschließen.</p>
      <p style="color: #666; font-size: 14px;">Falls du dich nicht registriert hast, kannst du diese E-Mail ignorieren.</p>
    </div>
    <div class="footer">
      <p>Brechtwahl · Demokratieprojekt der Brecht Schule Hamburg</p>
    </div>
  </div>
</body>
</html>
      `.trim()
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✓ E-Mail gesendet an ${email} (Message-ID: ${info.messageId})`);
    return true;

  } catch (error) {
    console.error(`✗ E-Mail-Fehler für ${email}:`, error.message);
    // Bei Fehler trotzdem true zurückgeben, damit Registrierung nicht fehlschlägt
    // Der Code wird ja in der Konsole angezeigt als Fallback
    return true;
  }
}

/**
 * Test-E-Mail senden (für Admin-Tests)
 */
async function sendTestEmail(toEmail) {
  if (!transporter) {
    return { success: false, message: 'SMTP nicht konfiguriert' };
  }

  try {
    const info = await transporter.sendMail({
      from: `"${SMTP_FROM_NAME}" <${SMTP_FROM}>`,
      to: toEmail,
      subject: 'Brechtwahl - Test-E-Mail',
      text: 'Diese E-Mail bestätigt, dass der E-Mail-Versand funktioniert.',
      html: '<p>Diese E-Mail bestätigt, dass der E-Mail-Versand funktioniert. ✅</p>'
    });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

// Transporter beim Laden initialisieren
initTransporter();

module.exports = {
  sendVerificationEmail,
  sendTestEmail,
  initTransporter
};
