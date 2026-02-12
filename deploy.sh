#!/bin/bash
# ===========================================
# Brechtwahl Deployment Script für Debian 13
# ===========================================

set -e

echo "╔════════════════════════════════════════════╗"
echo "║     Brechtwahl Deployment Script           ║"
echo "╚════════════════════════════════════════════╝"

# ─────────────────────────────────────────────
# SCHRITT 1: PM2 installieren (falls nicht vorhanden)
# ─────────────────────────────────────────────
echo ""
echo ">>> Schritt 1: PM2 prüfen/installieren"

if ! command -v pm2 &> /dev/null; then
    echo "PM2 wird installiert..."
    npm install -g pm2
else
    echo "✓ PM2 bereits installiert"
fi

# ─────────────────────────────────────────────
# SCHRITT 2: Backend mit PM2 starten
# ─────────────────────────────────────────────
echo ""
echo ">>> Schritt 2: Backend starten"

cd /opt/brecht-vote/backend

# Falls bereits läuft, neu starten
pm2 delete brecht-vote 2>/dev/null || true
pm2 start server.js --name brecht-vote

echo "✓ Backend läuft auf Port 3000"

# ─────────────────────────────────────────────
# SCHRITT 3: PM2 Autostart aktivieren
# ─────────────────────────────────────────────
echo ""
echo ">>> Schritt 3: PM2 Autostart"

pm2 startup systemd -u root --hp /root
pm2 save

echo "✓ PM2 Autostart aktiviert"

# ─────────────────────────────────────────────
# SCHRITT 4: Nginx installieren (falls nicht vorhanden)
# ─────────────────────────────────────────────
echo ""
echo ">>> Schritt 4: Nginx prüfen/installieren"

if ! command -v nginx &> /dev/null; then
    echo "Nginx wird installiert..."
    apt update
    apt install -y nginx
else
    echo "✓ Nginx bereits installiert"
fi

# ─────────────────────────────────────────────
# SCHRITT 5: Nginx konfigurieren
# ─────────────────────────────────────────────
echo ""
echo ">>> Schritt 5: Nginx konfigurieren"

# Kopiere Konfig
cp /opt/brecht-vote/nginx-vote.conf /etc/nginx/sites-available/vote
ln -sf /etc/nginx/sites-available/vote /etc/nginx/sites-enabled/vote

# Default-Site deaktivieren
rm -f /etc/nginx/sites-enabled/default

# Nginx testen und neu starten
nginx -t
systemctl restart nginx
systemctl enable nginx

echo "✓ Nginx konfiguriert und gestartet"

# ─────────────────────────────────────────────
# SCHRITT 6: Frontend kopieren
# ─────────────────────────────────────────────
echo ""
echo ">>> Schritt 6: Frontend deployen"

mkdir -p /var/www/vote
cp -r /opt/brecht-vote/frontend/* /var/www/vote/

echo "✓ Frontend in /var/www/vote"

# ─────────────────────────────────────────────
# STATUS
# ─────────────────────────────────────────────
echo ""
echo "╔════════════════════════════════════════════╗"
echo "║           Deployment abgeschlossen         ║"
echo "╚════════════════════════════════════════════╝"
echo ""
echo "Backend Status:"
pm2 status

echo ""
echo "Nginx Status:"
systemctl status nginx --no-pager | head -5

echo ""
echo "────────────────────────────────────────────"
echo "Website erreichbar unter:"
echo "http://vote.brecht-schule.hamburg"
echo "────────────────────────────────────────────"
echo ""
echo "⚠️  WICHTIG: .env Datei anpassen!"
echo "   /opt/brecht-vote/backend/.env"
echo "   → JWT_SECRET ändern"
echo "   → ADMIN_CODE ändern"
echo "   → Dann: pm2 restart brecht-vote"
echo "────────────────────────────────────────────"
