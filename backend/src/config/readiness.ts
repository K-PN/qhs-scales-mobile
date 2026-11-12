import { RequestHandler } from "express";
import { db } from "./db.js";
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

let cached: { checkedAt: number; missing: string[] } | undefined;
let lastWarning = "";
export async function checkReadiness(force = false): Promise<string[]> {
  if (!force && cached && Date.now() - cached.checkedAt < 2000)
    return cached.missing;
  const [rows] = await db.execute(
    "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()",
  );
  const missing = missingTables(
    (rows as { name: string }[]).map((row) => row.name),
  );
  cached = { checkedAt: Date.now(), missing };
  const warning = missing.join(", ");
  if (warning && warning !== lastWarning) {
    logger.warn(
      `Application setup incomplete. Missing tables: ${warning}. Review backend/database/mobile-v2.sql before applying to the configured database.`,
    );
  }
  lastWarning = warning;
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
