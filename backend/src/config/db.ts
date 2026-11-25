import mysql from "mysql2/promise";
import { env } from "./env.js";
import { z } from "zod";
import { HttpError } from "../utils/http.js";

function createPool(database: string) {
  const connectionPool = mysql.createPool({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: "utf8mb4",
    dateStrings: true,
    timezone: "+07:00",
  });

  connectionPool.on("connection", (connection) => {
    connection.query("SET time_zone = '+07:00'");
  });
  return connectionPool;
}

export const pool = createPool(env.db.database);
if (env.secondDatabase && env.secondDatabase.toLowerCase() === env.db.database.toLowerCase())
  throw new Error("DB2_NAME must identify a different database.");
const secondary = env.secondDatabase
  ? createPool(env.secondDatabase)
  : undefined;
export const sessionTable = mysql.escapeId(env.db.database, true) + ".mobile_sessions";

export const databaseSource = z.enum(["db1", "db2"]);
export type DatabaseSource = z.infer<typeof databaseSource>;
export const databaseSources: DatabaseSource[] = secondary ? ["db1", "db2"] : ["db1"];

export function dbFor(source: DatabaseSource = "db1") {
  if (source === "db1") return pool;
  if (!secondary) throw new HttpError(503, "Database 2 chưa được cấu hình.");
  return secondary;
}

export const db = pool;

export async function execute<T = unknown>(sql: string, params: any[] = []) {
  const [rows] = await pool.execute(sql, params as any);
  return rows as T[];
}

export async function executeOne<T = Record<string, unknown>>(
  sql: string,
  params: any[] = [],
) {
  const [rows] = await pool.execute(sql, params as any);
  const result = (rows as T[])[0];
  return result ?? null;
}
