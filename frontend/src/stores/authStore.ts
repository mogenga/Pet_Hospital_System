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

// 注意：生产环境应使用 httpOnly cookie 存储 JWT，避免 XSS 窃取
// 当前 localStorage 方案适用于内网部署
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
        const token = get().token;
        set({ token: null, user: null });
        if (token) {
          // 显式传 token — set(null) 后拦截器取不到，后端需要 Bearer 头
          apiClient.post("/api/auth/logout", null, {
            headers: { Authorization: `Bearer ${token}` },
          }).catch((err) => {
            console.warn("登出 API 调用失败:", err?.message ?? err);
          });
        }
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
