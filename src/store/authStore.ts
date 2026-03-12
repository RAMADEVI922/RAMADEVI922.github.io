import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Admin {
  id: string;
  email: string;
  name: string;
}

interface AuthStore {
  admin: Admin | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

// Demo admin credentials (in production, this would be a backend API call)
const DEMO_ADMIN = {
  email: 'admin@qrmenu.com',
  password: 'admin123',
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      admin: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        
        try {
          // Simulate API call delay
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Demo authentication (in production, call your backend API)
          if (email === DEMO_ADMIN.email && password === DEMO_ADMIN.password) {
            const admin: Admin = {
              id: '1',
              email: email,
              name: 'Admin User',
            };
            set({
              admin,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
          } else {
            set({
              isLoading: false,
              error: 'Invalid email or password',
            });
            throw new Error('Invalid credentials');
          }
        } catch (err) {
          set({
            isLoading: false,
            error: err instanceof Error ? err.message : 'Login failed',
          });
          throw err;
        }
      },

      logout: () => {
        set({
          admin: null,
          isAuthenticated: false,
          error: null,
        });
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({
        admin: state.admin,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
