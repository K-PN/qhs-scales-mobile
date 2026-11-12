import Constants from "expo-constants";
import { Platform } from "react-native";
import { QueryClient } from "@tanstack/react-query";
import { useAuthStore, type AuthUser } from "../store/authStore";
import { ApiError, readApiResponse } from "./api-response";
export { ApiError } from "./api-response";

interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  message?: string;
}
const host = Constants.expoConfig?.hostUri?.split(":")[0];
export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ||
  (__DEV__
    ? Platform.OS === "web"
      ? "http://localhost:4010"
      : host
        ? "http://" + host + ":4010"
        : "http://10.0.2.2:4010"
    : "")
).replace(/\/$/, "");
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000, refetchOnWindowFocus: false },
  },
});
async function request(path: string, init?: RequestInit) {
  if (!API_URL) throw new Error("Chưa cấu hình địa chỉ máy chủ.");
  const controller = new AbortController(),
    timeout = setTimeout(() => controller.abort(), 15000);
  try {
    return await fetch(API_URL + path, {
      ...init,
      signal: init?.signal || controller.signal,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch (e) {
    throw new Error(
      e instanceof Error && e.name === "AbortError"
        ? "Kết nối quá lâu. Vui lòng thử lại."
        : "Không kết nối được máy chủ. Kiểm tra mạng và thử lại.",
    );
  } finally {
    clearTimeout(timeout);
  }
}
export async function login(payload: unknown) {
  const res = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
    data = await readApiResponse<AuthResponse>(res);
  if (!res.ok)
    throw new ApiError(res.status, data.message || "Không thể đăng nhập.");
  await useAuthStore.getState().setAuth(data);
  queryClient.clear();
}
let refreshing: Promise<void> | null = null;
async function refresh() {
  const initial = useAuthStore.getState();
  const res = await request("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken: initial.refreshToken }),
    }),
    data = await readApiResponse<Omit<AuthResponse, "refreshToken">>(res);
  if (!res.ok) {
    if (useAuthStore.getState().refreshToken === initial.refreshToken) {
      queryClient.clear();
      await useAuthStore.getState().clearAuth();
    }
    throw new ApiError(res.status, data.message || "Vui lòng đăng nhập lại.");
  }
  if (useAuthStore.getState().refreshToken !== initial.refreshToken)
    throw new Error("Phiên đã thay đổi.");
  await useAuthStore.getState().setAuth({
    user: data.user,
    accessToken: data.accessToken,
    refreshToken: initial.refreshToken!,
  });
}
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const send = () =>
    request(path, {
      ...init,
      headers: {
        ...init?.headers,
        Authorization: "Bearer " + useAuthStore.getState().accessToken,
      },
    });
  let res = await send();
  if (res.status === 401 && useAuthStore.getState().refreshToken) {
    if (!refreshing)
      refreshing = refresh().finally(() => {
        refreshing = null;
      });
    await refreshing;
    res = await send();
  }
  const data = await readApiResponse<T & { message?: string }>(res);
  if (!res.ok)
    throw new ApiError(res.status, data.message || "Không thể tải dữ liệu.");
  return data;
}
export async function logout() {
  try {
    await api("/auth/logout", { method: "POST" });
  } finally {
    queryClient.clear();
    await useAuthStore.getState().clearAuth();
  }
}
export function queryString(
  values: Record<string, string | number | undefined>,
) {
  return Object.entries(values)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(
      ([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(String(v)),
    )
    .join("&");
}
