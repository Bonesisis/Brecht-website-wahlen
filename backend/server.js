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
 */

// Umgebungsvariablen laden
require('dotenv').config();

const express = require('express');
const app = express();
const cors = require('cors');
const path = require('path');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Routes
const testRouter = require('./routes/test');
app.use('/api/test', testRouter);

// ==================== Konfiguration ====================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});
