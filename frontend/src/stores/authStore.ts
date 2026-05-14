import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/types";
import apiClient from "@/api/client";

interface AuthState {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: () => boolean;
  hasRole: (...roles: string[]) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,

      login: async (username, password) => {
        const res = await apiClient.post("/api/auth/login", { username, password });
        set({ token: res.data.access_token, user: res.data.user });
      },

      logout: () => {
        apiClient.post("/api/auth/logout").catch(() => {});
        set({ token: null, user: null });
      },

      isAuthenticated: () => !!get().token,

      hasRole: (...roles) => {
        const user = get().user;
        return !!user && roles.includes(user.role);
      },
    }),
    { name: "auth-storage" }
  )
);
