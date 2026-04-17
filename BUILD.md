# Building the Burooj Heights ERP Windows Installer

## Prerequisites

| Tool | Version | Download |
|------|---------|----------|
| Node.js | 18 or 20 LTS | https://nodejs.org |
| npm | 9+ (comes with Node) | — |

No PostgreSQL installation needed — the app bundles its own database.

---

## Step 1 — Add the app icon

Place a 256×256 `.ico` file at:

```
electron/assets/icon.ico
```

If you only have a PNG, convert it first (e.g. https://convertico.com).

---

## Step 2 — Configure credentials (optional)

If you want Firebase, WhatsApp, or S3 to work, create a file at:

```
%APPDATA%\Burooj Heights ERP\config.env
```

with the same key=value format as `backend/.env.example`.  
The app merges these values at startup.

Alternatively, edit the `env` object in `electron/main.js` directly before building.

---

## Step 3 — Install dependencies

```bash
# From the project root (burooj-erp/)
npm install

cd backend
npm install

cd ../frontend
npm install

cd ..
```

Or use the convenience script:

```bash
npm run install:all
```

---

## Step 4 — Build the React frontend

```bash
npm run build
```

Output goes to `frontend/build/`.

---

## Step 5 — Build the Windows installer

```bash
npm run dist
```

This runs `electron-builder --win --x64` and produces:

```
dist/
  Burooj Heights ERP Setup 1.0.0.exe   ← installer
  latest.yml                            ← auto-update manifest
```

The installer:
- Creates a **"Burooj Heights ERP"** desktop shortcut
- Creates a Start Menu entry
- Allows choosing the installation directory
- Bundles the full backend + database + frontend

---

## Step 6 — Test the installer

Run `dist/Burooj Heights ERP Setup 1.0.0.exe` on any Windows 10/11 x64 machine.  
On first launch the app will:
1. Initialize the embedded PostgreSQL database
2. Run SQL migrations
3. Start the backend server on port 5000
4. Open the React dashboard in a desktop window

---

## Auto-Updates

To enable auto-updates:

1. Create a GitHub repository (e.g. `buroojheights/erp-releases`)
2. Update `publish.owner` / `publish.repo` in `package.json` if different
3. Set the `GH_TOKEN` environment variable to a GitHub personal access token with `repo` scope
4. Run `npm run dist -- --publish always` to publish directly to GitHub Releases

On subsequent builds, increment `"version"` in `package.json` and publish again.  
Running users will be notified automatically.

---

## Development Mode

To test the Electron shell without building the installer:

```bash
# Terminal 1 (backend only)
cd backend && node src/server.js

# OR use the combined dev script from the root:
npm run electron:dev
```

This opens Electron loading `http://localhost:5000` using your local source files.

---

## Folder Structure Created

```
burooj-erp/
├── electron/
│   ├── main.js          ← Electron main process
│   ├── preload.js       ← Context bridge (renderer ↔ main)
│   ├── splash.html      ← Startup loading screen
│   └── assets/
│       ├── icon.ico     ← App icon (YOU MUST ADD THIS)
│       └── license.txt  ← Installer license text
├── package.json         ← Root Electron package + build config
└── BUILD.md             ← This file
```
