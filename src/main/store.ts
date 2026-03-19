export interface StoreSchema {
  // API Keys
  anthropicApiKey?: string;
  mondayApiKey?: string;

  // Google Service Account (bundled, but user's sheet access tracked here)
  googleSheetsConnected: boolean;
  googleServiceAccountEmail?: string;

  // Microsoft OAuth tokens
  microsoftAccessToken?: string;
  microsoftRefreshToken?: string;
  microsoftTokenExpiry?: number;

  // Onboarding
  onboardingComplete: boolean;

  // Sync settings
  syncIntervalMs: number;

  // Active event
  activeEventId?: string;
}

// Use any-typed store to avoid complex generics issues with electron-store + CommonJS
let store: any;

export async function initStore(): Promise<void> {
  const importDynamic = new Function('modulePath', 'return import(modulePath)');
  const { default: Store } = await importDynamic('electron-store');
  store = new Store({
    name: 'opsnest-config',
    encryptionKey: 'opsnest-conference-sync-v1',
    defaults: {
      googleSheetsConnected: false,
      onboardingComplete: false,
      syncIntervalMs: 120000, // 2 minutes
    },
  });
}

export function getStore(): { get: (key: string) => any; set: (key: string, value: any) => void } {
  if (!store) {
    throw new Error('Store not initialized. Call initStore() first.');
  }
  return store;
}
