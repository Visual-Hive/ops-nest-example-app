import type { OpsNestAPI } from '../../preload/index';

declare global {
  interface Window {
    opsnest: OpsNestAPI;
  }
}

export {};
