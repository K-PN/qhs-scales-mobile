import Constants from "expo-constants";
import { Platform } from "react-native";
import { QueryClient } from "@tanstack/react-query";
import { useAuthStore, userScope, type AuthUser, type DatabaseSource } from "../store/authStore";
import { ApiError, readApiResponse } from "./api-response";
export { ApiError } from "./api-response";

interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  message?: string;
  databaseSources?: DatabaseSource[];
}
export class LoginConflict extends ApiError {
  constructor(message: string, readonly sources: DatabaseSource[]) {
    super(409, message);
  }
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
  if (!__DEV__ && !API_URL.startsWith("https://"))
    throw new Error("Máy chủ phát hành phải dùng HTTPS.");
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
  if (res.status === 409)
    throw new LoginConflict(data.message || "Hãy chọn nguồn đăng nhập.", data.databaseSources ?? []);
  if (!res.ok)
    throw new ApiError(res.status, data.message || "Không thể đăng nhập.");
  queryClient.clear();
  useAuthStore.getState().setAdminSource("db1");
  await useAuthStore.getState().setAuth(data);
}
const refreshing = new Map<string, Promise<void>>();
async function refresh(refreshToken: string) {
  const initial = useAuthStore.getState();
  const res = await request("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }),
    data = await readApiResponse<Omit<AuthResponse, "refreshToken">>(res);
  if (!res.ok) {
    if (res.status === 401 && useAuthStore.getState().refreshToken === refreshToken) {
      queryClient.clear();
      await useAuthStore.getState().clearAuth();
    }
    throw new ApiError(res.status, data.message || "Vui lòng đăng nhập lại.");
  }
  if (useAuthStore.getState().refreshToken !== refreshToken)
    throw new Error("Phiên đã thay đổi.");
  if (initial.user && JSON.stringify(userScope(initial.user)) !== JSON.stringify(userScope(data.user)))
    queryClient.clear();
  await useAuthStore.getState().setAuth({
    user: data.user,
    accessToken: data.accessToken,
    refreshToken,
  });
}
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const { refreshToken, user, adminSource } = useAuthStore.getState();
  if (user?.role === "admin" && adminSource === "db2" &&
      /^\/(?:admin|weighings|reports)(?:[/?]|$)/.test(path) &&
      !/[?&]source=/.test(path)) {
    path += (path.includes("?") ? "&" : "?") + "source=db2";
  }
  const checkSession = () => {
    if (!refreshToken || useAuthStore.getState().refreshToken !== refreshToken)
      throw new Error("Phiên đã thay đổi.");
  };
  const send = () =>
    request(path, {
      ...init,
      headers: {
        ...init?.headers,
        Authorization: "Bearer " + useAuthStore.getState().accessToken,
      },
    });
  checkSession();
  let res = await send();
  checkSession();
  if (res.status === 401) {
    let pending = refreshing.get(refreshToken!);
    if (!pending) {
      pending = refresh(refreshToken!).finally(() => refreshing.delete(refreshToken!));
      refreshing.set(refreshToken!, pending);
    }
    await pending;
    checkSession();
    res = await send();
  }
  const data = await readApiResponse<T & { message?: string }>(res);
  checkSession();
  if (!res.ok)
    throw new ApiError(res.status, data.message || "Không thể tải dữ liệu.");
  return data;
}
export async function logout() {
  const session = useAuthStore.getState();
  if (!session.accessToken || !session.refreshToken) return;
  void request("/auth/logout", {
    method: "POST",
    headers: { Authorization: "Bearer " + session.accessToken },
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  }).catch(() => {});
  queryClient.clear();
  await session.clearAuth();
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
