import { databaseSources, dbFor, type DatabaseSource } from "./db.js";
import { HttpError } from "../utils/http.js";
import { notArchived } from "./access.js";
import { enabled } from "../utils/security.js";

type StationType = "truck" | "durian";
interface StationConfigRow {
  station_type: StationType;
  data_source: DatabaseSource;
  data_station_id: number;
  revision: string;
}
export interface StationConfig {
  stationType: StationType;
  dataSource: DatabaseSource;
  dataStationId: number;
  revision?: string;
}

const tableCache = new Map<DatabaseSource, { expiresAt: number; value: Promise<Set<string>> }>();

export function sourceTables(source: DatabaseSource) {
  const cached = tableCache.get(source);
  if (cached && Date.now() < cached.expiresAt) return cached.value;
  const value = dbFor(source)
    .execute("SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()")
    .then(([rows]) => new Set((rows as { name: string }[]).map(({ name }) => name)))
    .catch((error) => {
      if (tableCache.get(source)?.value === value) tableCache.delete(source);
      throw error;
    });
  tableCache.set(source, { expiresAt: Date.now() + 60_000, value });
  return value;
}

export function effectiveStationConfig(
  source: DatabaseSource,
  stationId: number,
  row?: Partial<StationConfigRow>,
): StationConfig {
  return {
    stationType: row?.station_type ?? "truck",
    dataSource: row?.data_source ?? source,
    dataStationId: row?.data_station_id ?? stationId,
    revision: row?.revision,
  };
}

export async function stationConfig(source: DatabaseSource, stationId: number) {
  if (!(await sourceTables(source)).has("mobile_station_config")) {
    if (databaseSources.length > 1)
      throw new HttpError(503, "Nguồn tài khoản chưa có bảng cấu hình trạm.");
    return effectiveStationConfig(source, stationId);
  }
  const [rows] = await dbFor(source).execute(
    "SELECT station_type,data_source,data_station_id,revision FROM mobile_station_config WHERE station_id=?",
    [stationId],
  );
  return effectiveStationConfig(source, stationId, (rows as StationConfigRow[])[0]);
}

export async function validateDataStation(
  config: StationConfig,
  identitySource: DatabaseSource,
  identityStationId?: number,
) {
  const tables = await sourceTables(config.dataSource);
  const dataTable = config.stationType === "truck" ? "tbweight" : "qhs_durian_records";
  if (!tables.has(dataTable))
    throw new HttpError(409, "Nguồn đã chọn thiếu bảng dữ liệu cho loại trạm này.");
  if (config.dataSource === identitySource) {
    if (identityStationId !== undefined && config.dataStationId !== identityStationId)
      throw new HttpError(400, "Trạm trong cùng database phải dùng mã trạm của nó.");
    return;
  }
  await requireDataStation(config, identitySource);
}

export async function requireDataStation(config: StationConfig, identitySource: DatabaseSource) {
  if (config.dataSource === identitySource) return;
  await requireActiveStation(config.dataSource, config.dataStationId);
}

async function requireActiveStation(source: DatabaseSource, id: number) {
  const [rows] = await dbFor(source).execute(
    `SELECT enable FROM tbusers_group WHERE id=? AND ${notArchived("station", "tbusers_group.id")}`,
    [id],
  );
  if (!enabled((rows as { enable: unknown }[])[0]?.enable))
    throw new HttpError(409, "Trạm dữ liệu không tồn tại hoặc đã bị khóa.");
}

export async function stationAccess(source: DatabaseSource, stationId: number) {
  const config = await stationConfig(source, stationId);
  if (config.stationType === "truck")
    return { ...config, stationType: "truck", canReadDurian: false } as const;
  if (!(await sourceTables(config.dataSource)).has("qhs_durian_records"))
    return { ...config, stationType: "unknown", canReadDurian: false } as const;
  return { ...config, stationType: "durian", canReadDurian: true } as const;
}
