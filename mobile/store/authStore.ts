import { create } from "zustand";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
export interface AuthUser {
  id: number;
  username: string;
  fullName: string;
  role: "admin" | "station";
  stationId: number | null;
  stationName: string | null;
  legacyRole: string | null;
  viewAll: boolean;
}
interface Session {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}
interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  ready: boolean;
  hydrate: () => Promise<void>;
  setAuth: (s: Session) => Promise<void>;
  clearAuth: () => Promise<void>;
}
const key = "qhs.session.v2";
async function read() {
  return Platform.OS === "web"
    ? typeof sessionStorage === "undefined"
      ? null
      : sessionStorage.getItem(key)
    : SecureStore.getItemAsync(key);
}
async function write(value: string | null) {
  if (Platform.OS === "web") {
    if (typeof sessionStorage !== "undefined") {
      if (value) sessionStorage.setItem(key, value);
      else sessionStorage.removeItem(key);
    }
    return;
  }
  if (value) await SecureStore.setItemAsync(key, value);
  else await SecureStore.deleteItemAsync(key);
}
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  ready: false,
  hydrate: async () => {
    try {
      const raw = await read();
      const s = raw ? JSON.parse(raw) : null;
      if (
        s?.user &&
        ["admin", "station"].includes(s.user.role) &&
        typeof s.accessToken === "string" &&
        typeof s.refreshToken === "string"
      )
        set({ ...s, ready: true });
      else set({ ready: true });
    } catch {
      set({ ready: true });
    }
  },
  setAuth: async (s) => {
    await write(JSON.stringify(s));
    set({ ...s, ready: true });
  },
  clearAuth: async () => {
    set({ user: null, accessToken: null, refreshToken: null, ready: true });
    await write(null);
  },
}));
