# ============================================================
# BUROOJ HEIGHTS ERP — INSTALLATION & DEPLOYMENT GUIDE
# ============================================================

## TABLE OF CONTENTS
1. Prerequisites
2. Local Development Setup
3. Database Setup
4. Environment Variables
5. Running the App
6. Production Deployment (AWS + Docker)
7. SSL Setup
8. WhatsApp Cloud API Setup
9. Firebase Push Notifications
10. Troubleshooting

---

## 1. PREREQUISITES

Install these on your system:
- Node.js 20+ (https://nodejs.org)
- PostgreSQL 15+ (https://postgresql.org)
- Docker & Docker Compose (https://docker.com)
- Git

---

## 2. LOCAL DEVELOPMENT SETUP

```bash
# Clone the project
git clone https://github.com/your-org/burooj-erp.git
cd burooj-erp

# Install Backend dependencies
cd backend
npm install

# Install Frontend dependencies
cd ../frontend
npm install
```

---

## 3. DATABASE SETUP

```bash
# Create database
psql -U postgres -c "CREATE DATABASE burooj_erp;"

# Run migrations (creates all tables + seed data)
psql -U postgres -d burooj_erp -f backend/migrations/001_complete_schema.sql

# Verify
psql -U postgres -d burooj_erp -c "\dt"
```

Default admin credentials:
- Email:    admin@buroojheights.com
- Password: Admin@123

---

## 4. ENVIRONMENT VARIABLES

```bash
# Backend
cd backend
cp .env.example .env
nano .env   # Fill in your values
```

Required values:
```
DB_PASSWORD=your_database_password
JWT_SECRET=minimum_32_character_random_string
WA_PHONE_NUMBER_ID=from_meta_business_dashboard
WA_ACCESS_TOKEN=your_whatsapp_api_token
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_S3_BUCKET=your_bucket_name
```

```bash
# Frontend
cd frontend
echo "REACT_APP_API_URL=http://localhost:5000/api/v1" > .env
```

---

## 5. RUNNING THE APP (Development)

```bash
# Terminal 1 — Backend
cd backend
npm run dev
# → API running at http://localhost:5000

# Terminal 2 — Frontend
cd frontend
npm start
# → App running at http://localhost:3000
```

---

## 6. PRODUCTION DEPLOYMENT (Docker + AWS)

### Step 1: Prepare AWS EC2

```bash
# Ubuntu 22.04 LTS recommended
# Launch EC2 t3.medium or larger

# Connect via SSH
ssh -i your-key.pem ubuntu@your-ec2-ip

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker ubuntu
sudo apt install docker-compose-plugin -y
```

### Step 2: Upload Project

```bash
# From your local machine
scp -r ./burooj-erp ubuntu@your-ec2-ip:~/

# Or use git
ssh ubuntu@your-ec2-ip
git clone https://github.com/your-org/burooj-erp.git
cd burooj-erp
```

### Step 3: Configure Environment

```bash
cd burooj-erp/backend
cp .env.example .env
nano .env  # Fill all production values

# Create .env for docker-compose
cat > .env << EOF
DB_PASSWORD=StrongPassword123!
REACT_APP_API_URL=https://api.buroojheights.com/api/v1
EOF
```

### Step 4: SSL Certificate (Let's Encrypt)

```bash
sudo apt install certbot -y

# Get certificate
sudo certbot certonly --standalone -d buroojheights.com -d www.buroojheights.com

# Copy certs
sudo mkdir -p /home/ubuntu/burooj-erp/nginx/ssl
sudo cp /etc/letsencrypt/live/buroojheights.com/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/buroojheights.com/privkey.pem nginx/ssl/
sudo chown -R ubuntu:ubuntu nginx/ssl/
```

### Step 5: Deploy with Docker

```bash
cd ~/burooj-erp

# Build and start all services
docker compose up -d --build

# Check status
docker compose ps
docker compose logs -f backend

# View logs
docker compose logs --tail=100 backend
docker compose logs --tail=100 nginx
```

### Step 6: Configure AWS

1. **S3 Bucket** (for file uploads):
   - Create bucket: `burooj-erp-files`
   - Enable CORS for your domain
   - Create IAM user with S3 full access
   - Add credentials to .env

2. **Route 53** (DNS):
   - Create A record: `buroojheights.com → EC2 IP`
   - Create A record: `www.buroojheights.com → EC2 IP`

3. **Security Group** (Firewall):
   - Allow port 80 (HTTP)
   - Allow port 443 (HTTPS)
   - Allow port 22 (SSH)

---

## 7. WHATSAPP CLOUD API SETUP

1. Go to: https://developers.facebook.com
2. Create App → Business
3. Add "WhatsApp" product
4. Get Phone Number ID and Access Token
5. Set Webhook URL: `https://yourdomain.com/api/v1/whatsapp/webhook`
6. Add to .env:
   ```
   WA_PHONE_NUMBER_ID=your_phone_number_id
   WA_ACCESS_TOKEN=your_permanent_token
   WA_VERIFY_TOKEN=any_random_string
   ```

---

## 8. FIREBASE PUSH NOTIFICATIONS

1. Go to: https://console.firebase.google.com
2. Create Project → Project Settings → Service Accounts
3. Generate New Private Key → download JSON
4. Extract values to .env:
   ```
   FIREBASE_PROJECT_ID=your_project_id
   FIREBASE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk@project.iam.gserviceaccount.com
   ```

---

## 9. COMMON COMMANDS

```bash
# Restart services
docker compose restart backend

# View running containers
docker compose ps

# Database backup
docker exec burooj_db pg_dump -U postgres burooj_erp > backup_$(date +%Y%m%d).sql

# Database restore
docker exec -i burooj_db psql -U postgres burooj_erp < backup.sql

# Stop everything
docker compose down

# Stop and remove data (CAREFUL!)
docker compose down -v

# Update and redeploy
git pull
docker compose up -d --build backend
```

---

## 10. TROUBLESHOOTING

**Backend won't start:**
```bash
docker compose logs backend
# Check DB connection, env variables
```

**Database connection refused:**
```bash
docker compose ps postgres
# Should show "healthy"
docker compose restart postgres
```

**WhatsApp not sending:**
- Verify WA_ACCESS_TOKEN is not expired
- Check phone number is verified
- Test API: curl -X POST https://graph.facebook.com/...

**File uploads failing:**
- Check AWS credentials
- Verify S3 bucket CORS settings
- Ensure IAM user has s3:PutObject permission

---

## 11. DEFAULT USERS

After setup, login with:

| Email | Password | Role |
|-------|----------|------|
| admin@buroojheights.com | Admin@123 | Admin |

Create more users via Settings → Users panel.

---

## 12. SUPPORT

For technical support:
- Email: it@buroojheights.com
- System version: 1.0.0

---

*Burooj Heights ERP v1.0.0 — Built with ❤️*
