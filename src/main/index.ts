import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { startServer, stopServer } from './server';
import { registerAuthHandlers } from './ipc/auth.ipc';
import { registerSyncHandlers } from './ipc/sync.ipc';
import { registerEmailHandlers } from './ipc/email.ipc';
import { registerAiHandlers } from './ipc/ai.ipc';
import { registerDataHandlers } from './ipc/data.ipc';
import { registerEventsHandlers } from './ipc/events.ipc';
import { initDatabase } from './db';
import { initStore } from './store';

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'OpsNest Conference Sync',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    // Initialize storage and database
    await initStore();
    initDatabase();

    // Start the internal Express server (for OAuth callbacks)
    await startServer();

    // Register IPC handlers
    registerAuthHandlers(ipcMain);
    registerSyncHandlers(ipcMain);
    registerEmailHandlers(ipcMain);
    registerAiHandlers(ipcMain);
    registerDataHandlers(ipcMain);
    registerEventsHandlers(ipcMain);

    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    console.error('Startup failed:', message);
    dialog.showErrorBox('Startup Error', `Failed to initialize:\n\n${message}`);
    app.quit();
  }
});

app.on('window-all-closed', async () => {
  await stopServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
