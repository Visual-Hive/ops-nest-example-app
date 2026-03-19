import { create } from 'zustand';
import type { AuthStatus } from '../../shared/models';

interface AuthState {
  status: AuthStatus;
  loading: boolean;
  setStatus: (status: AuthStatus) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: {
    anthropicConfigured: false,
    mondayConfigured: false,
    googleConfigured: false,
    microsoftConfigured: false,
    onboardingComplete: false,
  },
  loading: true,
  setStatus: (status) => set({ status }),
  setLoading: (loading) => set({ loading }),
}));
