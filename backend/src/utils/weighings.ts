import { z } from "zod";
import { AppUser } from "../types/auth.js";
import { databaseSource, dbFor } from "../config/db.js";
import { requireDataStation, stationConfig } from "../config/station-type.js";
import { HttpError } from "./http.js";
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
  );
export const filters = z
  .object({
    q: z.string().trim().max(100).default(""),
    startDate: date.optional(),
    endDate: date.optional(),
    stationId: z.coerce.number().int().positive().optional(),
    source: databaseSource.optional(),
    creatorId: z.coerce.number().int().positive().optional(),
    status: z.enum(["all", "pending", "complete"]).default("all"),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .refine((v) => !v.startDate || !v.endDate || v.startDate <= v.endDate, {
    message: "Khoảng ngày không hợp lệ",
  });
export type Filters = z.infer<typeof filters>;

export async function weighingData(user: AppUser, filters: Partial<Filters>) {
  const source = user.source ?? "db1";
  if (user.role === "station") {
    const dataSource = user.dataSource ?? source;
    const dataStationId = user.dataStationId ?? user.stationId;
    if (!dataStationId) throw new HttpError(403, "Tài khoản chưa được gán trạm.");
    await requireDataStation({ stationType: "truck", dataSource, dataStationId }, source);
    return { db: dbFor(dataSource), user: { ...user, stationId: dataStationId } };
  }
  const selected = filters.source ?? "db1";
  if (!filters.stationId) return { db: dbFor(selected), user };
  const config = await stationConfig(selected, filters.stationId);
  if (config.stationType !== "truck")
    throw new HttpError(400, "Trạm đã chọn chạy cân sầu riêng.");
  await requireDataStation(config, selected);
  return {
    db: dbFor(config.dataSource),
    user: { ...user, role: "station" as const, stationId: config.dataStationId },
  };
}
export function weighingScope(user: AppUser, f: Partial<Filters> = {}) {
  const clauses: string[] = ["w.enable=1"],
    params: (string | number)[] = [];
  if (user.role === "station") {
    if (!user.stationId) throw new Error("Missing station scope");
    clauses.push("w.idusergroup=?");
    params.push(user.stationId);
  } else if (f.stationId) {
    clauses.push("w.idusergroup=?");
    params.push(f.stationId);
  }
  if (f.creatorId) {
    clauses.push("w.createby=?");
    params.push(f.creatorId);
  }
  if (f.q) {
    clauses.push(
      "(w.truct_no LIKE ? OR w.formcode LIKE ? OR w.customer_name LIKE ?)",
    );
    params.push(...Array(3).fill("%" + f.q + "%"));
  }
  if (f.startDate) {
    clauses.push("w.date_in>=?");
    params.push(f.startDate);
  }
  if (f.endDate) {
    clauses.push("w.date_in<DATE_ADD(?,INTERVAL 1 DAY)");
    params.push(f.endDate);
  }
  if (f.status === "pending") clauses.push("w.weight_2 IS NULL");
  if (f.status === "complete") clauses.push("w.weight_2 IS NOT NULL");
  return { sql: clauses.join(" AND "), params };
}
export const joins =
  "FROM tbweight w LEFT JOIN tbusers u ON u.id=w.createby AND u.idusergroup=w.idusergroup LEFT JOIN tbusers_group g ON g.id=w.idusergroup";
export const columns =
  "w.id,w.formcode,w.truct_no,w.customer_name,w.items_name,w.date_in,w.date_out,w.weight_1,w.weight_2,w.net_weight,w.price_total,w.notes,w.createby,w.idusergroup,u.username creator_name,g.name station_name";
