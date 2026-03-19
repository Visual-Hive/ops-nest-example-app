import type { IpcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';

export function registerEmailHandlers(ipcMain: IpcMain): void {
  // Stub handlers - will be fully implemented in Phase 4

  ipcMain.handle(IPC.EMAIL_GET_INBOX, async () => {
    return { emails: [] };
  });

  ipcMain.handle(IPC.EMAIL_GET_THREAD, async (_event, _emailId: string) => {
    return { thread: [] };
  });

  ipcMain.handle(IPC.EMAIL_DRAFT_REPLY, async (_event, _emailId: string, _intent: string) => {
    return { draft: null };
  });

  ipcMain.handle(IPC.EMAIL_SEND, async (_event, _draftId: string) => {
    return { success: false, message: 'Not yet implemented' };
  });

  ipcMain.handle(IPC.EMAIL_GET_DRAFTS, async () => {
    return { drafts: [] };
  });
}
