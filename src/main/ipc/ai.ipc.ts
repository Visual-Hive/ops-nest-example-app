import type { IpcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';

export function registerAiHandlers(ipcMain: IpcMain): void {
  // Stub handlers - will be fully implemented in Phase 4

  ipcMain.handle(IPC.AI_CLASSIFY_EMAIL, async (_event, _subject: string, _body: string) => {
    return { classification: null };
  });

  ipcMain.handle(
    IPC.AI_COMPOSE_DRAFT,
    async (_event, _vendorId: string, _intent: string) => {
      return { draft: null };
    }
  );

  ipcMain.handle(IPC.AI_RUN_ESCALATION_REVIEW, async () => {
    return { escalations: [] };
  });
}
