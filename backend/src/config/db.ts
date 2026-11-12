import mysql from "mysql2/promise";
import { env } from "./env.js";

export const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: "utf8mb4",
  dateStrings: true,
  timezone: "+07:00",
});

pool.on("connection", (connection) => {
  connection.query("SET time_zone = '+07:00'");
});

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
