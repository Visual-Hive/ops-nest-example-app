// Hook to access the IPC bridge safely
export function useApi() {
  if (!window.opsnest) {
    throw new Error('OpsNest API not available. Are you running inside Electron?');
  }
  return window.opsnest;
}
