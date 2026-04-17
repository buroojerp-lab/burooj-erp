// ============================================================
// BUROOJ HEIGHTS ERP - ELECTRON MAIN PROCESS
// ============================================================

const { app, BrowserWindow, dialog, ipcMain, Menu, Tray, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const { fork } = require('child_process');
const path = require('path');
const fs = require('fs');
// embedded-postgres is an ESM module — loaded dynamically in startDatabase()
const isDev = require('electron-is-dev');
const log = require('electron-log');

// ── Logging Setup ──
log.transports.file.level = 'info';
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

log.info('Burooj Heights ERP starting...');

let mainWindow = null;
let backendProcess = null;
let pg = null;
let tray = null;

const BACKEND_PORT = 5001;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;

// ── Splash / Loading Window ──
function createSplashWindow() {
  const splash = new BrowserWindow({
    width: 500,
    height: 340,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    icon: path.join(__dirname, 'assets/icon.ico'),
    webPreferences: { contextIsolation: true },
  });
  splash.loadFile(path.join(__dirname, 'splash.html'));
  splash.center();
  return splash;
}

// ── Database ──
async function startDatabase() {
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  const pgDataDir = path.join(app.getPath('userData'), 'pgdata');
  log.info(`PostgreSQL data directory: ${pgDataDir}`);

  pg = new EmbeddedPostgres({
    databaseDir: pgDataDir,
    user: 'burooj_user',
    password: 'BuroojERP2024!',
    port: 5432,
    persistent: true,
  });

  await pg.initialise();
  await pg.start();
  log.info('PostgreSQL started');

  // Create the application database if it does not exist
  const client = pg.getPgClient();
  await client.connect();
  try {
    await client.query('CREATE DATABASE burooj_erp');
    log.info('Database burooj_erp created');
  } catch (err) {
    // Database already exists — fine
    log.info('Database burooj_erp already exists');
  } finally {
    await client.end();
  }
}

// ── Backend Server ──
async function startBackend() {
  const serverPath = isDev
    ? path.join(__dirname, '../backend/src/server.js')
    : path.join(process.resourcesPath, 'backend/src/server.js');

  const frontendBuildPath = isDev
    ? path.join(__dirname, '../frontend/build')
    : path.join(process.resourcesPath, 'frontend/build');

  // Load user-level config overrides (for Firebase, WhatsApp, S3, etc.)
  const userConfigPath = path.join(app.getPath('userData'), 'config.env');
  let userConfig = {};
  if (fs.existsSync(userConfigPath)) {
    const lines = fs.readFileSync(userConfigPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const idx = trimmed.indexOf('=');
        if (idx !== -1) {
          userConfig[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
        }
      }
    }
    log.info(`Loaded user config from ${userConfigPath}`);
  }

  const env = {
    ...process.env,
    ...userConfig,
    NODE_ENV: 'production',
    PORT: String(BACKEND_PORT),
    DB_HOST: 'localhost',
    DB_PORT: '5432',
    DB_NAME: 'burooj_erp',
    DB_USER: 'burooj_user',
    DB_PASSWORD: 'BuroojERP2024!',
    DB_POOL_MIN: '2',
    DB_POOL_MAX: '10',
    SERVE_STATIC: 'true',
    FRONTEND_BUILD_PATH: frontendBuildPath,
    FRONTEND_URL: BACKEND_URL,
    JWT_SECRET: userConfig.JWT_SECRET || 'burooj-erp-jwt-secret-change-before-production',
    JWT_REFRESH_SECRET: userConfig.JWT_REFRESH_SECRET || 'burooj-erp-refresh-secret-change-before-production',
    JWT_EXPIRES_IN: '7d',
    JWT_REFRESH_EXPIRES: '30d',
  };

  log.info(`Spawning backend from: ${serverPath}`);
  backendProcess = fork(serverPath, [], { env, silent: false });

  backendProcess.on('error', (err) => {
    log.error('Backend process error:', err);
  });

  backendProcess.on('exit', (code, signal) => {
    log.warn(`Backend exited — code: ${code}, signal: ${signal}`);
  });

  // Wait for the health endpoint to respond (max 30 s)
  await waitForBackend(BACKEND_URL + '/health', 30000);
  log.info('Backend is ready');
}

function waitForBackend(url, timeout) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const http = require('http');

    function check() {
      http.get(url, (res) => {
        if (res.statusCode === 200) return resolve();
        retry();
      }).on('error', retry);
    }

    function retry() {
      if (Date.now() - start > timeout) {
        return reject(new Error(`Backend did not start within ${timeout / 1000}s`));
      }
      setTimeout(check, 500);
    }

    check();
  });
}

// ── Run Database Migrations ──
async function runMigrations() {
  const migrationsPath = isDev
    ? path.join(__dirname, '../backend/src/utils/runMigrations.js')
    : path.join(process.resourcesPath, 'backend/src/utils/runMigrations.js');

  if (!fs.existsSync(migrationsPath)) {
    log.warn('runMigrations.js not found — skipping migrations');
    return;
  }

  await new Promise((resolve, reject) => {
    const proc = fork(migrationsPath, [], {
      env: {
        ...process.env,
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_NAME: 'burooj_erp',
        DB_USER: 'burooj_user',
        DB_PASSWORD: 'BuroojERP2024!',
      },
      silent: false,
    });
    proc.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`Migrations failed with code ${code}`))));
    proc.on('error', reject);
  });

  log.info('Migrations completed');
}

// ── Main Window ──
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Burooj Heights ERP',
    icon: path.join(__dirname, 'assets/icon.ico'),
    show: false,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadURL(BACKEND_URL);

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open external links in the default browser, not in Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Build application menu
  const menuTemplate = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Data Folder',
          click: () => shell.openPath(app.getPath('userData')),
        },
        { type: 'separator' },
        { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(isDev ? [{ type: 'separator' }, { role: 'toggleDevTools' }] : []),
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Check for Updates',
          click: () => autoUpdater.checkForUpdates(),
        },
        {
          label: `Version ${app.getVersion()}`,
          enabled: false,
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));
}

// ── System Tray ──
function createTray() {
  const iconPath = path.join(__dirname, 'assets/icon.ico');
  if (!fs.existsSync(iconPath)) return;

  tray = new Tray(iconPath);
  tray.setToolTip('Burooj Heights ERP');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Open',
        click: () => {
          if (mainWindow) mainWindow.show();
        },
      },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() },
    ])
  );

  tray.on('double-click', () => {
    if (mainWindow) mainWindow.show();
  });
}

// ── IPC Handlers ──
ipcMain.handle('get-version', () => app.getVersion());
ipcMain.handle('install-update', () => autoUpdater.quitAndInstall());

// ── Auto Updater Events ──
autoUpdater.on('update-available', (info) => {
  log.info('Update available:', info.version);
  if (mainWindow) mainWindow.webContents.send('update-available', info);
});

autoUpdater.on('update-downloaded', (info) => {
  log.info('Update downloaded:', info.version);
  if (mainWindow) mainWindow.webContents.send('update-downloaded', info);
});

autoUpdater.on('error', (err) => {
  log.error('AutoUpdater error:', err.message);
});

// ── App Lifecycle ──
app.whenReady().then(async () => {
  const splash = createSplashWindow();

  try {
    if (isDev) {
      // In dev mode, backend + system postgres are already running via concurrently
      log.info('Dev mode — waiting for already-running backend...');
      await waitForBackend(BACKEND_URL + '/health', 15000);
    } else {
      log.info('Step 1/3 — Starting database...');
      await startDatabase();

      log.info('Step 2/3 — Running migrations...');
      await runMigrations();

      log.info('Step 3/3 — Starting backend server...');
      await startBackend();
    }

    splash.close();
    createMainWindow();
    createTray();

    if (!isDev) {
      // Delay update check so the window is fully rendered first
      setTimeout(() => autoUpdater.checkForUpdatesAndNotify(), 5000);
    }
  } catch (err) {
    log.error('Startup failed:', err);
    splash.close();
    dialog.showErrorBox(
      'Burooj Heights ERP — Startup Error',
      `The application failed to start.\n\n${err.message}\n\nPlease check the logs at:\n${log.transports.file.getFile().path}`
    );
    app.quit();
  }
});

app.on('window-all-closed', async () => {
  log.info('All windows closed — shutting down...');
  if (backendProcess) {
    backendProcess.kill('SIGTERM');
    backendProcess = null;
  }
  if (pg) {
    try {
      await pg.stop();
    } catch (err) {
      log.error('Error stopping PostgreSQL:', err);
    }
    pg = null;
  }
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});
