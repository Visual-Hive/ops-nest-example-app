import type { IpcMain } from 'electron';
import { shell } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { getStore } from '../store';
import { testAnthropicConnection, resetClient as resetAnthropicClient } from '../services/claude.service';
import { testMondayConnection, getBoards, isMondayConfigured } from '../services/monday.service';
import {
  testSheetsAccess,
  getServiceAccountEmail,
  getSpreadsheetInfo,
} from '../services/sheets.service';
import {
  getMicrosoftAuthUrl,
  testMicrosoftConnection,
  isMicrosoftConfigured,
} from '../services/outlook.service';
import type { AuthStatus } from '../../shared/models';

export function registerAuthHandlers(ipcMain: IpcMain): void {
  // Save an API key
  ipcMain.handle(
    IPC.AUTH_SAVE_KEY,
    async (_event, keyName: string, keyValue: string) => {
      const store = getStore();
      if (keyName === 'anthropic') {
        store.set('anthropicApiKey', keyValue);
        resetAnthropicClient();
      } else if (keyName === 'monday') {
        store.set('mondayApiKey', keyValue);
      }
      return { success: true };
    }
  );

  // Get a stored key (masked)
  ipcMain.handle(IPC.AUTH_GET_KEY, async (_event, keyName: string) => {
    const store = getStore();
    let key: string | undefined;
    if (keyName === 'anthropic') {
      key = store.get('anthropicApiKey');
    } else if (keyName === 'monday') {
      key = store.get('mondayApiKey');
    }
    if (key) {
      return { configured: true, masked: key.substring(0, 8) + '...' + key.slice(-4) };
    }
    return { configured: false, masked: null };
  });

  // Test connection for a service
  ipcMain.handle(IPC.AUTH_TEST_CONNECTION, async (_event, service: string) => {
    try {
      if (service === 'anthropic') {
        const ok = await testAnthropicConnection();
        return { success: ok, message: ok ? 'Connected to Claude' : 'Connection failed' };
      }
      if (service === 'monday') {
        const result = await testMondayConnection();
        return { success: true, message: `Connected as ${result.name}` };
      }
      if (service === 'microsoft') {
        const result = await testMicrosoftConnection();
        return {
          success: true,
          message: `Connected as ${result.displayName} (${result.mail})`,
        };
      }
      return { success: false, message: `Unknown service: ${service}` };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Connection failed',
      };
    }
  });

  // Start Google Sheets connection (Service Account approach)
  ipcMain.handle(IPC.AUTH_START_GOOGLE, async () => {
    const email = getServiceAccountEmail();
    return { serviceAccountEmail: email };
  });

  // Check if sheets access is working
  ipcMain.handle(
    IPC.AUTH_CHECK_SHEETS_ACCESS,
    async (_event, spreadsheetId: string) => {
      try {
        const hasAccess = await testSheetsAccess(spreadsheetId);
        if (hasAccess) {
          const info = await getSpreadsheetInfo(spreadsheetId);
          const store = getStore();
          store.set('googleSheetsConnected', true);
          return { success: true, title: info.title, sheets: info.sheets };
        }
        return {
          success: false,
          message: 'Cannot access this spreadsheet. Please share it with the service account email.',
        };
      } catch (err) {
        return {
          success: false,
          message: err instanceof Error ? err.message : 'Access check failed',
        };
      }
    }
  );

  // Start Microsoft OAuth
  ipcMain.handle(IPC.AUTH_START_MICROSOFT, async () => {
    const url = getMicrosoftAuthUrl();
    await shell.openExternal(url);
    return { started: true };
  });

  // Get Monday boards (for board selection)
  ipcMain.handle(IPC.AUTH_GET_MONDAY_BOARDS, async () => {
    try {
      const boards = await getBoards();
      return { success: true, boards };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Failed to fetch boards',
        boards: [],
      };
    }
  });

  // Get overall auth status
  ipcMain.handle(IPC.AUTH_GET_STATUS, async (): Promise<AuthStatus> => {
    const store = getStore();
    return {
      anthropicConfigured: !!store.get('anthropicApiKey'),
      mondayConfigured: isMondayConfigured(),
      googleConfigured: store.get('googleSheetsConnected') || false,
      microsoftConfigured: isMicrosoftConfigured(),
      onboardingComplete: store.get('onboardingComplete') || false,
    };
  });
}
