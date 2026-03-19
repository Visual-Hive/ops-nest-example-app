// IPC channel names - used by both main and renderer via preload bridge

export const IPC = {
  // Auth
  AUTH_SAVE_KEY: 'auth:save-key',
  AUTH_GET_KEY: 'auth:get-key',
  AUTH_TEST_CONNECTION: 'auth:test-connection',
  AUTH_START_GOOGLE: 'auth:start-google',
  AUTH_START_MICROSOFT: 'auth:start-microsoft',
  AUTH_GET_STATUS: 'auth:get-status',
  AUTH_CHECK_SHEETS_ACCESS: 'auth:check-sheets-access',
  AUTH_GET_MONDAY_BOARDS: 'auth:get-monday-boards',

  // Sync
  SYNC_START: 'sync:start',
  SYNC_STOP: 'sync:stop',
  SYNC_NOW: 'sync:now',
  SYNC_STATUS: 'sync:status',
  SYNC_ON_UPDATE: 'sync:on-update',

  // Data
  DATA_GET_AREAS: 'data:get-areas',
  DATA_GET_EQUIPMENT: 'data:get-equipment',
  DATA_GET_VENDORS: 'data:get-vendors',
  DATA_UPDATE_EQUIPMENT: 'data:update-equipment',
  DATA_GET_ESCALATIONS: 'data:get-escalations',
  DATA_RESOLVE_ESCALATION: 'data:resolve-escalation',

  // Email
  EMAIL_GET_INBOX: 'email:get-inbox',
  EMAIL_GET_THREAD: 'email:get-thread',
  EMAIL_DRAFT_REPLY: 'email:draft-reply',
  EMAIL_SEND: 'email:send',
  EMAIL_GET_DRAFTS: 'email:get-drafts',

  // AI
  AI_CLASSIFY_EMAIL: 'ai:classify-email',
  AI_COMPOSE_DRAFT: 'ai:compose-draft',
  AI_RUN_ESCALATION_REVIEW: 'ai:run-escalation-review',

  // Events (multi-event support)
  EVENTS_LIST: 'events:list',
  EVENTS_CREATE: 'events:create',
  EVENTS_SELECT: 'events:select',
  EVENTS_GET_ACTIVE: 'events:get-active',
  EVENTS_UPDATE: 'events:update',

  // Sheets helpers
  SHEETS_GET_HEADERS: 'sheets:get-headers',
  SHEETS_IMPORT: 'sheets:import',

  // Monday helpers
  MONDAY_IMPORT: 'monday:import',
} as const;

export type IPCChannel = (typeof IPC)[keyof typeof IPC];
