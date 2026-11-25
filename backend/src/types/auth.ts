import type { DatabaseSource } from "../config/db.js";

export type AuthKind = "admin" | "station" | "station2";

export interface AppUser {
  authKind?: AuthKind;
  source?: DatabaseSource;
  databaseSources?: DatabaseSource[];
  dataSource?: DatabaseSource;
  dataStationId?: number;
  id: number;
  fullName: string;
  username: string;
  role: "admin" | "station";
  stationId: number | null;
  stationName: string | null;
  stationType?: "truck" | "durian" | "unknown";
  permissions?: ("truck:read" | "durian:read" | "admin:manage")[];
  legacyRole: string | null;
  viewAll: boolean;
  credential: string;
}
