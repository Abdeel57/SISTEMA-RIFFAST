import { create } from 'zustand';
import type { AuthUserDTO } from '@bismark/shared';
import { authService } from '@/services/auth';
import { ApiError } from '@/lib/api';

interface AuthState {
  user: AuthUserDTO | null;
  loading: boolean;
  initialized: boolean;
  setUser: (user: AuthUserDTO | null) => void;
  fetchMe: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  initialized: false,
  setUser: (user) => set({ user }),
  fetchMe: async () => {
    set({ loading: true });
    try {
      const { user } = await authService.me();
      set({ user, loading: false, initialized: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        set({ user: null, loading: false, initialized: true });
      } else {
        set({ loading: false, initialized: true });
      }
    }
  },
  logout: async () => {
    try {
      await authService.logout();
    } finally {
      set({ user: null });
    }
  },
}));
