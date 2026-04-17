#!/bin/bash
# ============================================================
# Burooj ERP — Hostinger VPS Deployment Script
# Domain: erp.buroojmarketing.com
# Run: bash deploy.sh
# ============================================================

set -e

DOMAIN="erp.buroojmarketing.com"
EMAIL="work.talalmalik@gmail.com"
APP_DIR="/opt/burooj-erp"

echo "======================================"
echo " Burooj ERP — Production Deploy"
echo " Domain: $DOMAIN"
echo "======================================"

# ── 1. System update + Docker ──────────────────────────────
echo "[1/6] Installing Docker..."
apt-get update -qq
apt-get install -y -qq curl git ufw

if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
fi

if ! command -v docker-compose &> /dev/null; then
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
         -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi

echo "Docker: $(docker --version)"
echo "Compose: $(docker-compose --version)"

# ── 2. Firewall ────────────────────────────────────────────
echo "[2/6] Configuring firewall..."
ufw allow ssh
ufw allow 80
ufw allow 443
ufw --force enable

# ── 3. Upload app files ────────────────────────────────────
echo "[3/6] Setting up app directory..."
mkdir -p $APP_DIR
echo ""
echo ">>> Copy your project files to $APP_DIR now (use WinSCP or scp)"
echo ">>> Then press ENTER to continue..."
read -r

# ── 4. SSL Certificate (Let's Encrypt) ────────────────────
echo "[4/6] Getting SSL certificate..."
apt-get install -y -qq certbot

# Start temporary nginx for ACME challenge
docker run -d --rm --name tmp_nginx \
    -p 80:80 \
    -v /var/www/certbot:/var/www/certbot \
    nginx:alpine \
    sh -c "mkdir -p /var/www/certbot && nginx -g 'daemon off;'" 2>/dev/null || true

certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$DOMAIN" || {
        echo "Webroot failed, trying standalone..."
        docker stop tmp_nginx 2>/dev/null || true
        certbot certonly \
            --standalone \
            --email "$EMAIL" \
            --agree-tos \
            --no-eff-email \
            -d "$DOMAIN"
    }

docker stop tmp_nginx 2>/dev/null || true

# Copy certs to nginx/ssl
mkdir -p $APP_DIR/nginx/ssl
cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem $APP_DIR/nginx/ssl/fullchain.pem
cp /etc/letsencrypt/live/$DOMAIN/privkey.pem   $APP_DIR/nginx/ssl/privkey.pem
chmod 644 $APP_DIR/nginx/ssl/*.pem

echo "SSL certificate installed."

# ── 5. Auto-renew SSL ──────────────────────────────────────
cat > /etc/cron.d/certbot-renew << 'CRON'
0 3 * * * root certbot renew --quiet && \
    cp /etc/letsencrypt/live/erp.buroojmarketing.com/fullchain.pem /opt/burooj-erp/nginx/ssl/fullchain.pem && \
    cp /etc/letsencrypt/live/erp.buroojmarketing.com/privkey.pem /opt/burooj-erp/nginx/ssl/privkey.pem && \
    docker exec burooj_nginx nginx -s reload
CRON

# ── 6. Launch Docker stack ─────────────────────────────────
echo "[5/6] Building and starting containers..."
cd $APP_DIR

# Set DB password
if grep -q "CHANGE_THIS_STRONG_PASSWORD" backend/.env.production; then
    echo ""
    echo ">>> Set your DB password in backend/.env.production first!"
    echo ">>> Also set JWT_SECRET and JWT_REFRESH_SECRET"
    echo ">>> Press ENTER when done..."
    read -r
fi

DB_PASSWORD=$(grep "^DB_PASSWORD=" backend/.env.production | cut -d'=' -f2)

DB_PASSWORD=$DB_PASSWORD docker-compose up -d --build

echo ""
echo "[6/6] Waiting for services to start..."
sleep 15
docker-compose ps

echo ""
echo "======================================"
echo " DONE! ERP is live at:"
echo " https://$DOMAIN"
echo ""
echo " Admin login:"
echo "   admin@buroojheights.com"
echo "   Admin@123"
echo "======================================"
