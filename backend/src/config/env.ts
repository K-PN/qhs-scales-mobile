import dotenv from "dotenv";

dotenv.config();

if (
  process.env.NODE_ENV === "production" &&
  (!process.env.JWT_ACCESS_SECRET || process.env.JWT_ACCESS_SECRET.length < 32)
) {
  throw new Error(
    "JWT_ACCESS_SECRET must contain at least 32 characters in production.",
  );
}

export const env = {
  durianStationIds: (process.env.QHS_DURIAN_STATION_IDS || "")
    .split(",")
    .map(Number)
    .filter((id) => Number.isSafeInteger(id) && id > 0),
  companyStationId: Number(process.env.QHS_COMPANY_STATION_ID || 0),
  companyAdminUserIds: (process.env.QHS_COMPANY_ADMIN_USER_IDS || "")
    .split(",")
    .map(Number)
    .filter((v) => Number.isInteger(v) && v > 0),
  env: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 4010),
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || "dev-access-secret",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || "dev-refresh-secret",
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  db: {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "can15657_canquochung",
  },
  secondDatabase: process.env.DB2_NAME?.trim() || "",
  secondDurianStationIds: (process.env.QHS_DURIAN_STATION_IDS_DB2 || "")
    .split(",")
    .map(Number)
    .filter((id) => Number.isSafeInteger(id) && id > 0),
  clientUrl:
    process.env.CLIENT_URL ||
    "http://localhost:3000,http://localhost:8081,http://127.0.0.1:3000,http://127.0.0.1:8081",
};
