import { RequestHandler } from "express";
import { databaseSources, dbFor, type DatabaseSource } from "./db.js";
import { HttpError } from "../utils/http.js";
import { logger } from "../utils/logger.js";

export const requiredTables = [
  "app_users",
  "mobile_user_access",
  "mobile_sessions",
  "mobile_admin_audit",
  "tbusers",
  "tbusers_group",
  "tbusers_role",
  "tbweight",
] as const;

export function missingTables(names: string[]): string[] {
  const present = new Set(names);
  return requiredTables.filter((name) => !present.has(name));
}

const readiness = new Map<DatabaseSource, { checkedAt: number; missing: string[] }>();
export async function checkReadiness(force = false, source: DatabaseSource = "db1"): Promise<string[]> {
  const cached = readiness.get(source);
  if (!force && cached && Date.now() - cached.checkedAt < 2000) return cached.missing;
  const [rows] = await dbFor(source).execute(
    "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()",
  );
  const names = (rows as { name: string }[]).map((row) => row.name);
  const missing = missingTables(names);
  if (databaseSources.length > 1 && !names.includes("mobile_station_config"))
    missing.push("mobile_station_config");
  readiness.set(source, { checkedAt: Date.now(), missing });
  const warning = missing.join(", ");
  if (warning && warning !== cached?.missing.join(", ")) {
    logger.warn(
      `Application setup incomplete for ${source}. Missing tables: ${warning}.`,
    );
  }
  return missing;
}

export const requireReady: RequestHandler = (_req, _res, next) => {
  void checkReadiness()
    .then((missing) =>
      next(
        missing.length
          ? new HttpError(
              503,
              "Hệ thống chưa hoàn tất thiết lập đăng nhập. Vui lòng liên hệ quản trị QHS.",
            )
          : undefined,
      ),
    )
    .catch(next);
};
