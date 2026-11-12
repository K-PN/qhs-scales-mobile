export interface AppUser {
  authKind?: "admin" | "station";
  id: number;
  fullName: string;
  username: string;
  role: "admin" | "station";
  stationId: number | null;
  stationName: string | null;
  legacyRole: string | null;
  viewAll: boolean;
  credential: string;
}
