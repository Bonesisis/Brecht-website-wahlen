# Brechtwahl Backend

Backend für die digitale Abstimmungsplattform der Brecht Schule Hamburg.

## Tech-Stack

- **Node.js** + **Express** - Web-Server
- **SQLite** (better-sqlite3) - Datenbank (eine Datei: `db.sqlite`)
- **JWT** - Authentifizierung
- **bcrypt** - Passwort-Hashing

## Schnellstart

### 1. Dependencies installieren

```bash
cd backend
npm install
```

### 2. Konfiguration

Kopiere `.env.example` zu `.env` und passe die Werte an:

```bash
cp .env.example .env
```

**Wichtige Einstellungen in `.env`:**

```env
PORT=3000
CORS_ORIGIN=*                        # Oder deine GitHub Pages URL
JWT_SECRET=ein-sicheres-geheimnis    # Unbedingt ändern!
ADMIN_CODE=dein-admin-code           # Für Admin-Endpoints
SERVE_FRONTEND=false                 # true = Frontend aus ../ ausliefern
```

### 3. Server starten

**Entwicklung (mit Auto-Reload):**
```bash
npm run dev
```

**Produktion:**
```bash
npm start
```

## API-Endpoints

### Auth

| Methode | Endpoint | Beschreibung |
|---------|----------|--------------|
| POST | `/api/register` | Account erstellen |
| POST | `/api/login` | Einloggen |

### Polls

| Methode | Endpoint | Beschreibung |
|---------|----------|--------------|
| GET | `/api/polls` | Alle Abstimmungen |
| GET | `/api/polls/:id` | Eine Abstimmung |

### Voting

| Methode | Endpoint | Auth | Beschreibung |
|---------|----------|------|--------------|
| POST | `/api/vote` | JWT | Abstimmen |
| GET | `/api/results?poll_id=...` | - | Ergebnisse |

### Admin (X-Admin-Code Header erforderlich)

| Methode | Endpoint | Beschreibung |
|---------|----------|--------------|
| POST | `/api/admin/polls` | Poll erstellen |
| PATCH | `/api/admin/polls/:id` | Poll bearbeiten |
| DELETE | `/api/admin/polls/:id` | Poll löschen |
| GET | `/api/admin/results?poll_id=...` | Ergebnisse |

## Test-Curls

### Registrierung
```bash
curl -X POST http://localhost:3000/api/register \
  -H "Content-Type: application/json" \
  -d '{"email": "max.mustermann@brecht-schulen.de", "password": "test123"}'
```

### Login
```bash
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email": "max.mustermann@brecht-schulen.de", "password": "test123"}'
```

### Alle Polls abrufen
```bash
curl http://localhost:3000/api/polls
```

### Poll erstellen (Admin)
```bash
curl -X POST http://localhost:3000/api/admin/polls \
  -H "Content-Type: application/json" \
  -H "X-Admin-Code: brecht-admin-2026" \
  -d '{"title": "Neue Abstimmung", "active": true}'
```

### Abstimmen (mit JWT-Token)
```bash
curl -X POST http://localhost:3000/api/vote \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer DEIN_TOKEN_HIER" \
  -d '{"poll_id": "POLL_ID_HIER", "choice": "yes"}'
```

### Ergebnisse abrufen
```bash
curl "http://localhost:3000/api/results?poll_id=POLL_ID_HIER"
```

### Poll deaktivieren (Admin)
```bash
curl -X PATCH http://localhost:3000/api/admin/polls/POLL_ID_HIER \
  -H "Content-Type: application/json" \
  -H "X-Admin-Code: brecht-admin-2026" \
  -d '{"active": false}'
```

## Frontend-Integration

Im Frontend muss `USE_MOCK = false` gesetzt und die API-Basis konfiguriert werden:

```javascript
// In app.js
const USE_MOCK = false;
const API_BASE = 'http://localhost:3000/api';  // Oder deine Server-URL
```

**Für GitHub Pages:**
```javascript
const API_BASE = 'https://dein-server.de/api';
```

## Deployment auf Ubuntu-VM

1. **Node.js installieren:**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

2. **Backend-Ordner kopieren:**
   ```bash
   scp -r backend/ user@server:/path/to/app/
   ```

3. **Dependencies installieren:**
   ```bash
   cd /path/to/app/backend
   npm install --production
   ```

4. **`.env` erstellen und anpassen**

5. **Mit PM2 starten (empfohlen):**
   ```bash
   npm install -g pm2
   pm2 start server.js --name brechtwahl
   pm2 save
   pm2 startup
   ```

## Datenbank

Die SQLite-Datenbank wird automatisch erstellt (`db.sqlite`).

**Schema:**
- `users` - Benutzer (id, email, password_hash, created_at)
- `polls` - Abstimmungen (id, title, active, created_at)
- `votes` - Stimmen (id, poll_id, user_id, choice, created_at)

**Datenbank zurücksetzen:**
```bash
rm db.sqlite
npm start  # Erstellt neue leere DB
```

## Sicherheitshinweise

- ⚠️ `JWT_SECRET` in Produktion unbedingt ändern!
- ⚠️ `ADMIN_CODE` sicher und geheim halten
- ⚠️ In Produktion CORS einschränken auf deine Domain
- ⚠️ HTTPS verwenden (via Nginx Reverse Proxy)
