import { create } from "zustand";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
export type DatabaseSource = "db1" | "db2";
export interface AuthUser {
  id: number;
  username: string;
  fullName: string;
  role: "admin" | "station";
  stationId: number | null;
  stationName: string | null;
  stationType?: "truck" | "durian" | "unknown";
  source?: DatabaseSource;
  dataSource?: DatabaseSource;
  databaseSources?: DatabaseSource[];
  permissions?: ("truck:read" | "durian:read" | "admin:manage")[];
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
  adminSource: DatabaseSource;
  setAdminSource: (source: DatabaseSource) => void;
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
let pendingWrite = Promise.resolve();
function persist(value: string | null) {
  const task = pendingWrite.then(() => write(value));
  pendingWrite = task.catch(() => {});
  return task;
}
export function userScope(user: AuthUser | null) {
  return [user?.role, user?.id, user?.stationId, user?.stationType, user?.source, user?.dataSource];
}
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  ready: false,
  adminSource: "db1",
  setAdminSource: (adminSource) => set({ adminSource }),
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
    set({ ...s, ready: true });
    await persist(JSON.stringify(s));
  },
  clearAuth: async () => {
    set({ user: null, accessToken: null, refreshToken: null, ready: true, adminSource: "db1" });
    await persist(null);
  },
}));
