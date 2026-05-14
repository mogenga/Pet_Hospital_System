import axios from "axios";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/authStore";

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000",
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

// request 拦截器 — 注入 token
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// response 拦截器 — 401/403 处理
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // /logout 自身 401 不触发二次登出，避免循环
      if (!error.config?.url?.includes("/auth/logout")) {
        useAuthStore.getState().logout();
        window.location.href = "/login";
      }
    } else if (error.response?.status === 403) {
      window.location.href = "/403";
    } else {
      const detail = error.response?.data?.detail;
      if (typeof detail === "string") {
        toast.error(detail);
      } else {
        toast.error("请求失败");
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
