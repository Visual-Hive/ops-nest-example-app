import type { IpcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import {
  startSyncEngine,
  stopSyncEngine,
  runSyncCycle,
  getSyncStatus,
} from '../services/sync-engine.service';

export function registerSyncHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IPC.SYNC_START, async () => {
    startSyncEngine();
    return { success: true };
  });

  ipcMain.handle(IPC.SYNC_STOP, async () => {
    stopSyncEngine();
    return { success: true };
  });

  ipcMain.handle(IPC.SYNC_NOW, async () => {
    await runSyncCycle();
    return getSyncStatus();
  });

  ipcMain.handle(IPC.SYNC_STATUS, async () => {
    return getSyncStatus();
  });
}
