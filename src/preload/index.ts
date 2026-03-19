import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/ipc-channels';

// Expose a safe API to the renderer via contextBridge
const api = {
  // Auth
  saveKey: (keyName: string, keyValue: string) =>
    ipcRenderer.invoke(IPC.AUTH_SAVE_KEY, keyName, keyValue),
  getKey: (keyName: string) => ipcRenderer.invoke(IPC.AUTH_GET_KEY, keyName),
  testConnection: (service: string) =>
    ipcRenderer.invoke(IPC.AUTH_TEST_CONNECTION, service),
  startGoogleAuth: () => ipcRenderer.invoke(IPC.AUTH_START_GOOGLE),
  checkSheetsAccess: (spreadsheetId: string) =>
    ipcRenderer.invoke(IPC.AUTH_CHECK_SHEETS_ACCESS, spreadsheetId),
  startMicrosoftAuth: () => ipcRenderer.invoke(IPC.AUTH_START_MICROSOFT),
  getMondayBoards: () => ipcRenderer.invoke(IPC.AUTH_GET_MONDAY_BOARDS),
  getAuthStatus: () => ipcRenderer.invoke(IPC.AUTH_GET_STATUS),

  // Sync
  startSync: () => ipcRenderer.invoke(IPC.SYNC_START),
  stopSync: () => ipcRenderer.invoke(IPC.SYNC_STOP),
  syncNow: () => ipcRenderer.invoke(IPC.SYNC_NOW),
  getSyncStatus: () => ipcRenderer.invoke(IPC.SYNC_STATUS),

  // Data
  getAreas: () => ipcRenderer.invoke(IPC.DATA_GET_AREAS),
  getEquipment: (areaId: string) =>
    ipcRenderer.invoke(IPC.DATA_GET_EQUIPMENT, areaId),
  getVendors: () => ipcRenderer.invoke(IPC.DATA_GET_VENDORS),
  updateEquipment: (id: string, updates: Record<string, unknown>) =>
    ipcRenderer.invoke(IPC.DATA_UPDATE_EQUIPMENT, id, updates),
  getEscalations: () => ipcRenderer.invoke(IPC.DATA_GET_ESCALATIONS),
  resolveEscalation: (id: string, resolution: string) =>
    ipcRenderer.invoke(IPC.DATA_RESOLVE_ESCALATION, id, resolution),
  getConflicts: () => ipcRenderer.invoke(IPC.DATA_GET_CONFLICTS),
  resolveConflict: (escalationId: string, chosenSource: string) =>
    ipcRenderer.invoke(IPC.DATA_RESOLVE_CONFLICT, escalationId, chosenSource),

  // Email
  getInbox: () => ipcRenderer.invoke(IPC.EMAIL_GET_INBOX),
  getThread: (emailId: string) =>
    ipcRenderer.invoke(IPC.EMAIL_GET_THREAD, emailId),
  draftReply: (emailId: string, intent: string) =>
    ipcRenderer.invoke(IPC.EMAIL_DRAFT_REPLY, emailId, intent),
  sendEmail: (draftId: string) => ipcRenderer.invoke(IPC.EMAIL_SEND, draftId),
  getDrafts: () => ipcRenderer.invoke(IPC.EMAIL_GET_DRAFTS),

  // AI
  classifyEmail: (subject: string, body: string) =>
    ipcRenderer.invoke(IPC.AI_CLASSIFY_EMAIL, subject, body),
  composeDraft: (vendorId: string, intent: string) =>
    ipcRenderer.invoke(IPC.AI_COMPOSE_DRAFT, vendorId, intent),
  runEscalationReview: () =>
    ipcRenderer.invoke(IPC.AI_RUN_ESCALATION_REVIEW),

  // Events
  listEvents: () => ipcRenderer.invoke(IPC.EVENTS_LIST),
  createEvent: (name: string, date: string, config?: Record<string, unknown>) =>
    ipcRenderer.invoke(IPC.EVENTS_CREATE, name, date, config),
  selectEvent: (eventId: string) =>
    ipcRenderer.invoke(IPC.EVENTS_SELECT, eventId),
  getActiveEvent: () => ipcRenderer.invoke(IPC.EVENTS_GET_ACTIVE),
  updateEvent: (eventId: string, updates: Record<string, unknown>) =>
    ipcRenderer.invoke(IPC.EVENTS_UPDATE, eventId, updates),

  // Sheets helpers
  getSheetHeaders: (spreadsheetId: string, sheetName: string) =>
    ipcRenderer.invoke(IPC.SHEETS_GET_HEADERS, spreadsheetId, sheetName),
  importFromSheets: (eventId: string) =>
    ipcRenderer.invoke(IPC.SHEETS_IMPORT, eventId),

  // Monday helpers
  importFromMonday: (eventId: string) =>
    ipcRenderer.invoke(IPC.MONDAY_IMPORT, eventId),
};

contextBridge.exposeInMainWorld('opsnest', api);

// Type declaration for the renderer
export type OpsNestAPI = typeof api;
