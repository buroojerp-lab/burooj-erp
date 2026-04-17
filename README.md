# 🏗️ Burooj Heights ERP

> **Enterprise Real Estate Management System**
> Complete ERP for property management, sales, installments, HR, accounting & more.

---

## 📋 Table of Contents
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Environment Setup](#environment-setup)
- [Docker Deployment](#docker-deployment)
- [Default Credentials](#default-credentials)
- [API Reference](#api-reference)

---

## ✨ Features

### 🏢 Property Management
- Tower / Floor / Unit management
- Unit types: Apartments, Shops, Offices, Penthouses
- Status tracking: Available → Reserved → Sold

### 📋 Sales & Bookings
- 4-step booking wizard
- Automatic installment schedule generation
- PDF agreement generation
- Digital booking confirmation via WhatsApp

### 💰 Finance & Accounting
- Installment tracking with late fee automation
- Payment recording and receipts
- Journal entries & ledger
- Balance sheet, Trial balance, Cash flow
- Profit & Loss reports

### 📱 WhatsApp Automation
- 5-day before due date reminder
- On due date reminder
- 3-day overdue reminder
- 30-day cancellation warning
- Payment confirmation message

### 👥 CRM
- Customer profiles with CNIC verification
- Document management
- Lead source tracking
- Booking history

### 👷 HR & Payroll
- Employee profiles
- Daily attendance marking (bulk)
- Leave request management
- Automatic salary calculation (Basic + HRA + Medical - PF - Tax)
- Monthly payroll processing
- Payslip generation & printing

### 📊 Reports
- Sales reports (monthly/quarterly/yearly)
- Installment collection reports
- Financial P&L reports
- Agent performance reports
- Unit availability reports
- Expense reports

### 🔐 Security
- JWT authentication with refresh tokens
- Role-based access: Admin, Manager, Sales Agent, Accountant, Investor
- Rate limiting
- Audit logging

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Tailwind CSS + Recharts |
| Backend | Node.js 20 + Express.js |
| Database | PostgreSQL 16 |
| Auth | JWT + bcrypt |
| File Upload | Multer + AWS S3 |
| OCR | Tesseract.js |
| WhatsApp | Meta Cloud API |
| Push Notif | Firebase Admin SDK |
| Cron Jobs | node-cron |
| PDF | PDFKit |
| Real-time | Socket.IO |
| Deployment | Docker + Nginx + AWS |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- Git

### 1. Clone & Install

```bash
git clone <repo-url>
cd burooj-erp

# Backend
cd backend
npm install
cp .env.example .env
# Edit .env with your values

# Frontend
cd ../frontend
npm install
```

### 2. Database Setup

```bash
# Create database
psql -U postgres -c "CREATE DATABASE burooj_erp;"

# Run migrations (creates all tables + seed data)
psql -U postgres -d burooj_erp -f backend/migrations/001_complete_schema.sql
```

### 3. Start Development

```bash
# Terminal 1 — Backend (port 5000)
cd backend && npm run dev

# Terminal 2 — Frontend (port 3000)
cd frontend && npm start
```

Open **http://localhost:3000**

---

## 📁 Project Structure

```
burooj-erp/
├── backend/
│   ├── migrations/
│   │   └── 001_complete_schema.sql    # Full PostgreSQL schema
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.js            # PostgreSQL pool
│   │   │   ├── firebase.js            # Firebase Admin
│   │   │   └── logger.js              # Winston logger
│   │   ├── controllers/
│   │   │   ├── authController.js      # JWT login/register
│   │   │   ├── dashboardController.js # Stats & charts
│   │   │   ├── installmentController.js # Schedule & payments
│   │   │   └── expenseController.js   # Expenses + OCR
│   │   ├── middleware/
│   │   │   ├── auth.js                # JWT authenticate/authorize
│   │   │   └── errorHandler.js        # Global error handler
│   │   ├── routes/                    # 20+ route files
│   │   ├── services/
│   │   │   ├── whatsappService.js     # WhatsApp Cloud API
│   │   │   └── cronService.js         # Automated cron jobs
│   │   └── server.js                  # Express app entry
│   ├── Dockerfile
│   ├── package.json
│   └── .env.example
│
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── components/
│   │   │   └── common/
│   │   │       ├── Layout.jsx         # Sidebar navigation
│   │   │       └── LoadingScreen.jsx  # App loader
│   │   ├── pages/                     # 23 page components
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Properties.jsx
│   │   │   ├── Bookings.jsx
│   │   │   ├── NewBooking.jsx
│   │   │   ├── BookingDetail.jsx
│   │   │   ├── Customers.jsx
│   │   │   ├── CustomerDetail.jsx
│   │   │   ├── Installments.jsx
│   │   │   ├── Payments.jsx
│   │   │   ├── Expenses.jsx
│   │   │   ├── HR.jsx
│   │   │   ├── Payroll.jsx
│   │   │   ├── Agents.jsx
│   │   │   ├── Investors.jsx
│   │   │   ├── Procurement.jsx
│   │   │   ├── Facility.jsx
│   │   │   ├── Finance.jsx
│   │   │   ├── Reports.jsx
│   │   │   ├── WhatsApp.jsx
│   │   │   ├── UnitDetail.jsx
│   │   │   ├── Users.jsx
│   │   │   ├── Settings.jsx
│   │   │   └── Login.jsx
│   │   ├── store/
│   │   │   └── authStore.js           # Zustand auth state
│   │   ├── utils/
│   │   │   ├── api.js                 # Axios + interceptors
│   │   │   └── format.js             # PKR formatting
│   │   ├── App.jsx                    # Routing
│   │   ├── index.js                   # Entry point
│   │   └── index.css                  # Tailwind + custom CSS
│   ├── Dockerfile
│   ├── nginx-app.conf
│   ├── tailwind.config.js
│   └── package.json
│
├── nginx/
│   └── nginx.conf                     # Reverse proxy config
├── docs/
│   └── INSTALLATION.md               # Full setup guide
├── docker-compose.yml                 # Full stack Docker
└── README.md
```

---

## ⚙️ Environment Setup

Copy `backend/.env.example` to `backend/.env` and fill:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=burooj_erp
DB_USER=postgres
DB_PASSWORD=your_password

# JWT (use strong random strings)
JWT_SECRET=minimum_32_character_secret_key
JWT_REFRESH_SECRET=another_32_character_secret

# WhatsApp Cloud API (Meta Business)
WA_PHONE_NUMBER_ID=your_phone_number_id
WA_ACCESS_TOKEN=your_access_token
WA_VERIFY_TOKEN=your_webhook_verify_token

# AWS S3 (for file uploads)
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=ap-south-1
AWS_S3_BUCKET=burooj-erp-files

# Firebase (push notifications)
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY=your_private_key
FIREBASE_CLIENT_EMAIL=your_client_email
```

---

## 🐳 Docker Deployment

```bash
# Set environment
cp backend/.env.example backend/.env
# Edit backend/.env with production values

# Build and start all services
docker compose up -d --build

# Check status
docker compose ps

# View logs
docker compose logs -f backend
```

Services started:
- **postgres** — PostgreSQL database (port 5432)
- **redis** — Redis cache (port 6379)
- **backend** — Node.js API (port 5000)
- **frontend** — React app (port 3000)
- **nginx** — Reverse proxy (ports 80, 443)

---

## 🔑 Default Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@buroojheights.com | Admin@123 |

> ⚠️ Change the admin password immediately after first login!

---

## 📡 API Reference

Base URL: `http://localhost:5000/api/v1`

| Module | Endpoint |
|--------|---------|
| Auth | `POST /auth/login` |
| Dashboard | `GET /dashboard/stats` |
| Properties | `GET /property/units` |
| Bookings | `GET /bookings` |
| Installments | `GET /installments` |
| Payments | `GET /payments` |
| Customers | `GET /customers` |
| Expenses | `GET /expenses` |
| HR | `GET /hr/employees` |
| Payroll | `GET /payroll` |
| Agents | `GET /agents` |
| Investors | `GET /investors` |
| Finance | `GET /finance/accounts` |
| Reports | `GET /reports/sales` |
| WhatsApp | `GET /whatsapp/logs` |

Full API docs available at: `GET /health` (server info)

---

## 📞 Support

- Email: it@buroojheights.com
- Version: 1.0.0
- Built with ❤️ for Burooj Heights
