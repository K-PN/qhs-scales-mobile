import { Router, type Request } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { PoolConnection } from "mysql2/promise";
import { databaseSource, dbFor, sessionTable, type DatabaseSource } from "../config/db.js";
import { env } from "../config/env.js";
import { isCompanyAdmin, notArchived } from "../config/access.js";
import { effectiveStationConfig, sourceTables, stationConfig, validateDataStation, type StationConfig } from "../config/station-type.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { enabled, fingerprint, legacyHash } from "../utils/security.js";
import { route, HttpError } from "../utils/http.js";
const router = Router();
router.use(requireAuth, requireRole("admin"));
const idSchema = z.coerce.number().int().positive();
const managementSource = (req: Request) => databaseSource.parse(req.query.source ?? "db1");
const listSchema = z.object({
  q: z.string().trim().max(100).default(""),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  stationId: idSchema.optional(),
  enabledOnly: z.enum(["1"]).optional(),
});
const stationSchema = z.object({
  name: z.string().trim().min(1).max(100),
  address: z.string().trim().max(255),
  phonenumber: z.string().trim().max(255),
  enabled: z.boolean(),
  data: z.object({
    stationType: z.enum(["truck", "durian"]),
    dataSource: databaseSource,
    dataStationId: idSchema.optional(),
  }).optional(),
});
const accountSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1)
    .max(10)
    .regex(/^[A-Za-z0-9_.@-]+$/),
  roleId: idSchema,
  enabled: z.boolean(),
  durianRole: z.enum(["none", "operator", "admin"]).optional(),
  viewAll: z
    .boolean()
    .optional()
    .transform(() => true),
});
const passwordSchema = z
  .string()
  .min(6)
  .max(64)
  .regex(/^[\x20-\x7E]+$/);
const userSelect = `SELECT u.*,r.name role_name,g.name station_name,g.enable station_enabled,COALESCE(a.view_all,0) view_all FROM tbusers u
 LEFT JOIN tbusers_role r ON r.idtbusers_role=u.iduserrole LEFT JOIN tbusers_group g ON g.id=u.idusergroup
 LEFT JOIN mobile_user_access a ON a.user_id=u.id`;
async function stationSelect(source: DatabaseSource) {
  return (await sourceTables(source)).has("mobile_station_config")
    ? "SELECT g.*,cfg.station_type,cfg.data_source,cfg.data_station_id,cfg.revision FROM tbusers_group g LEFT JOIN mobile_station_config cfg ON cfg.station_id=g.id"
    : "SELECT g.* FROM tbusers_group g";
}
function stationView(row: any, source: DatabaseSource) {
  const { revision, ...config } = effectiveStationConfig(source, row.id, row);
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    phonenumber: row.phonenumber,
    source,
    ...config,
    enabled: enabled(row.enable),
    startdate: row.startdate,
    enddate: row.enddate,
    version: fingerprint(row),
  };
}
function accountView(row: any) {
  return {
    id: row.id,
    username: row.username,
    stationId: row.idusergroup,
    stationName: row.station_name,
    stationEnabled: enabled(row.station_enabled),
    roleId: row.iduserrole,
    roleName: row.role_name,
    enabled: enabled(row.enable),
    viewAll: true,
    version: fingerprint(row),
  };
}
async function transaction<T>(source: DatabaseSource, work: (c: PoolConnection) => Promise<T>) {
  const c = await dbFor(source).getConnection();
  try {
    await c.beginTransaction();
    const result = await work(c);
    await c.commit();
    return result;
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}
async function prepareStationConfig(
  source: DatabaseSource,
  id: number | undefined,
  data: z.infer<typeof stationSchema>["data"],
) {
  if (!data) return undefined;
  if (!(await sourceTables(source)).has("mobile_station_config"))
    throw new HttpError(503, "Chưa cài đặt bảng cấu hình nguồn cho database này.");
  if (data.dataSource !== source && data.dataStationId === undefined)
    throw new HttpError(400, "Hãy chọn trạm dữ liệu trong database đích.");
  if (id === undefined && data.dataSource === source && data.dataStationId !== undefined)
    throw new HttpError(400, "Trạm mới trong cùng database sẽ tự nhận mã trạm.");
  const config = { ...data, dataStationId: data.dataStationId ?? id ?? 0 };
  await validateDataStation(config, source, id);
  return config;
}
async function saveStationConfig(c: PoolConnection, id: number, config: StationConfig) {
  await c.execute(
    "INSERT INTO mobile_station_config (station_id,station_type,data_source,data_station_id,revision) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE station_type=VALUES(station_type),data_source=VALUES(data_source),data_station_id=VALUES(data_station_id),revision=VALUES(revision)",
    [id, config.stationType, config.dataSource, config.dataStationId || id, randomUUID()],
  );
}
async function audit(
  c: PoolConnection,
  actor: number,
  action: string,
  entity: string,
  id: number,
  detail: unknown,
) {
  await c.execute(
    "INSERT INTO mobile_admin_audit (actor_id,action,entity,entity_id,detail) VALUES (?,?,?,?,?)",
    [actor, action, entity, id, JSON.stringify(detail)],
  );
}
function stale(row: any, version: string) {
  if (!row) throw new HttpError(404, "Không tìm thấy dữ liệu.");
  if (fingerprint(row) !== version)
    throw new HttpError(409, "Dữ liệu đã thay đổi. Hãy tải lại trước khi lưu.");
}
async function requireStation(c: PoolConnection, id: number) {
  const [rows] = await c.execute(
    `SELECT id,enable FROM tbusers_group WHERE id=? AND ${notArchived("station", "tbusers_group.id")} FOR UPDATE`,
    [id],
  );
  const station = (rows as { enable: unknown }[])[0];
  if (!station)
    throw new HttpError(404, "Trạm cân không tồn tại.");
  if (!enabled(station.enable)) throw new HttpError(409, "Không thể gán tài khoản vào trạm đã khóa.");
}
async function setDurianRole(
  c: PoolConnection,
  source: DatabaseSource,
  hasConfig: boolean,
  id: number,
  stationId: number,
  desired?: "none" | "operator" | "admin",
  previousStation?: number,
) {
  if (previousStation !== undefined && previousStation !== stationId) {
    await c.execute(
      "DELETE FROM qhs_durian_user_access WHERE GroupId=? AND UserId=?",
      [previousStation, id],
    );
  }
  if (desired === undefined) return;
  if (desired === "none") {
    await c.execute(
      "DELETE FROM qhs_durian_user_access WHERE GroupId=? AND UserId=?",
      [stationId, id],
    );
  } else {
    const [configRows] = hasConfig
      ? await c.execute("SELECT station_type FROM mobile_station_config WHERE station_id=?", [stationId])
      : [[]];
    if (effectiveStationConfig(source, stationId, (configRows as { station_type: "truck" | "durian" }[])[0]).stationType !== "durian")
      throw new HttpError(
        400,
        "Chỉ có thể cấp quyền sầu riêng ở trạm sầu riêng.",
      );
    await c.execute(
      "INSERT INTO qhs_durian_user_access (GroupId,UserId,Role) VALUES (?,?,?) ON DUPLICATE KEY UPDATE Role=VALUES(Role)",
      [stationId, id, desired],
    );
  }
}
const archiveSchema = z.object({ version: z.string().length(64) });
router.get(
  "/stations",
  route(async (req, res) => {
    const source = managementSource(req);
    const db = dbFor(source);
    const f = listSchema.parse(req.query),
      search = "%" + f.q + "%";
    const where =
      `WHERE ${notArchived("station", "g.id")} AND (?='' OR g.name LIKE ? OR g.phonenumber LIKE ?) ` +
      (f.enabledOnly ? " AND g.enable=1" : "");
    const [rows] = await db.execute(
      `${await stationSelect(source)} ${where} ORDER BY g.id DESC LIMIT ${f.limit} OFFSET ${(f.page - 1) * f.limit}`,
      [f.q, search, search],
    );
    const [count] = await db.execute(
      `SELECT COUNT(*) total FROM tbusers_group g ${where}`,
      [f.q, search, search],
    );
    res.json({
      items: (rows as any[]).map((row) => stationView(row, source)),
      routingAvailable: (await sourceTables(source)).has("mobile_station_config"),
      total: Number((count as any[])[0].total),
      page: f.page,
      limit: f.limit,
    });
  }),
);
router.post(
  "/stations",
  route(async (req, res) => {
    const source = managementSource(req);
    const b = stationSchema.parse(req.body);
    const config = await prepareStationConfig(source, undefined, b.data);
    const id = await transaction(source, async (c) => {
      const [result] = await c.execute(
        `INSERT INTO tbusers_group
   (name,address,phonenumber,lastid,startdate,enddate,sign_1,sign_2,sign_3,sign_4,idweight_apptype,idapp_types,enable)
   VALUES (?,?,?,0,NULL,NULL,NULL,NULL,NULL,NULL,1,1,?)`,
        [b.name, b.address, b.phonenumber, b.enabled ? 1 : 0],
      );
      const id = (result as any).insertId;
      if (config) await saveStationConfig(c, id, config);
      await audit(c, req.user!.id, "create", "station", id, b);
      return id;
    });
    res.status(201).json({ id, message: "Đã tạo trạm cân." });
  }),
);
router.get(
  "/stations/:id",
  route(async (req, res) => {
    const source = managementSource(req);
    const id = idSchema.parse(req.params.id);
    const [rows] = await dbFor(source).execute(
      `${await stationSelect(source)} WHERE g.id=? AND ${notArchived("station", "g.id")}`,
      [id],
    );
    const station = (rows as any[])[0];
    if (!station) throw new HttpError(404, "Trạm cân không tồn tại.");
    res.json(stationView(station, source));
  }),
);
router.patch(
  "/stations/:id",
  route(async (req, res) => {
    const source = managementSource(req);
    const id = idSchema.parse(req.params.id),
      b = stationSchema
        .extend({ version: z.string().length(64) })
        .parse(req.body);
    const [select, config] = await Promise.all([
      stationSelect(source),
      prepareStationConfig(source, id, b.data),
    ]);
    await transaction(source, async (c) => {
      const [rows] = await c.execute(
        `${select} WHERE g.id=? AND ${notArchived("station", "g.id")} FOR UPDATE`,
        [id],
      );
      stale((rows as any[])[0], b.version);
      if (source === "db1" && id === env.companyStationId && !b.enabled)
        throw new HttpError(
          409,
          "Trạm quản trị công ty phải duy trì hoạt động.",
        );
      await c.execute(
        "UPDATE tbusers_group SET name=?,address=?,phonenumber=?,enable=? WHERE id=?",
        [b.name, b.address, b.phonenumber, b.enabled ? 1 : 0, id],
      );
      if (config) await saveStationConfig(c, id, config);
      await c.execute(
        `UPDATE ${sessionTable} s JOIN tbusers u ON u.id=s.subject_id SET s.revoked_at=NOW() WHERE s.subject_kind=? AND u.idusergroup=?`,
        [source === "db1" ? "station" : "station2", id],
      );
      await audit(c, req.user!.id, "update", "station", id, {
        before: stationView((rows as any[])[0], source),
        after: {
          name: b.name,
          address: b.address,
          phonenumber: b.phonenumber,
          enabled: b.enabled,
          data: b.data,
        },
      });
    });
    res.json({ message: "Đã cập nhật trạm cân." });
  }),
);
router.delete(
  "/stations/:id",
  route(async (req, res) => {
    const source = managementSource(req);
    const id = idSchema.parse(req.params.id);
    const { version } = archiveSchema.parse(req.body);
    if (source === "db1" && id === env.companyStationId)
      throw new HttpError(409, "Không thể xóa trạm quản trị công ty.");
    const select = await stationSelect(source);
    await transaction(source, async (c) => {
      const [rows] = await c.execute(
        `${select} WHERE g.id=? AND ${notArchived("station", "g.id")} FOR UPDATE`,
        [id],
      );
      const station = (rows as any[])[0];
      stale(station, version);
      const [assigned] = await c.execute(
        `SELECT id FROM tbusers WHERE idusergroup=? AND ${notArchived("account", "tbusers.id")} LIMIT 1 FOR UPDATE`,
        [id],
      );
      if ((assigned as unknown[]).length)
        throw new HttpError(
          409,
          "Hãy chuyển hoặc xóa các tài khoản còn gán cho trạm trước.",
        );
      await c.execute("UPDATE tbusers_group SET enable=0 WHERE id=?", [id]);
      await audit(c, req.user!.id, "archive", "station", id, {
        before: stationView(station, source),
      });
    });
    res.json({ message: "Đã xóa trạm khỏi danh sách quản lý." });
  }),
);
router.get(
  "/roles",
  route(async (req, res) => {
    const [rows] = await dbFor(managementSource(req)).execute(
      "SELECT idtbusers_role id,name FROM tbusers_role WHERE enable=1 ORDER BY idtbusers_role",
    );
    res.json({ items: rows });
  }),
);
router.get(
  "/accounts",
  route(async (req, res) => {
    const source = managementSource(req);
    const db = dbFor(source);
    const f = listSchema.parse(req.query),
      params: any[] = ["%" + f.q + "%"];
    const where =
      ` WHERE u.username LIKE ? AND ${notArchived("account", "u.id")}` +
      (f.stationId ? " AND u.idusergroup=?" : "");
    if (f.stationId) params.push(f.stationId);
    const [rows] = await db.execute(
      `${userSelect}${where} ORDER BY u.id DESC LIMIT ${f.limit} OFFSET ${(f.page - 1) * f.limit}`,
      params,
    );
    const [count] = await db.execute(
      "SELECT COUNT(*) total FROM tbusers u" + where,
      params,
    );
    const accounts = (rows as any[]).map(accountView);
    const roles = new Map<string, string>();
    if (accounts.length && (await sourceTables(source)).has("qhs_durian_user_access")) {
      const [grants] = await db.execute(
        `SELECT GroupId,UserId,Role FROM qhs_durian_user_access WHERE UserId IN (${accounts.map(() => "?").join(",")})`,
        accounts.map((account) => account.id),
      );
      for (const grant of grants as {
        GroupId: number;
        UserId: number;
        Role: string;
      }[])
        roles.set(grant.GroupId + ":" + grant.UserId, grant.Role);
    }
    const config = new Map(await Promise.all([...new Set(accounts.map((a) => Number(a.stationId)))]
      .map(async (id) => [id, await stationConfig(source, id)] as const)));
    res.json({
      items: accounts.map((account) => ({
        ...account,
        stationType: config.get(Number(account.stationId))?.stationType,
        durianRole: roles.get(account.stationId + ":" + account.id) ?? "none",
      })),
      total: Number((count as any[])[0].total),
      page: f.page,
      limit: f.limit,
    });
  }),
);
router.post(
  "/accounts",
  route(async (req, res) => {
    const source = managementSource(req);
    const b = accountSchema
      .extend({ stationId: idSchema, password: passwordSchema })
      .parse(req.body);
    const tables = b.durianRole !== undefined ? await sourceTables(source) : undefined;
    const accessTable = tables?.has("qhs_durian_user_access");
    if (b.durianRole && b.durianRole !== "none" && !accessTable)
      throw new HttpError(503, "Chưa sẵn sàng để cấp quyền sầu riêng.");
    const id = await transaction(source, async (c) => {
      await requireStation(c, b.stationId);
      const [roles] = await c.execute(
        "SELECT idtbusers_role FROM tbusers_role WHERE idtbusers_role=? AND enable=1",
        [b.roleId],
      );
      if (!(roles as any[]).length)
        throw new HttpError(400, "Vai trò không hợp lệ.");
      const [duplicates] = await c.execute(
        "SELECT id FROM tbusers WHERE username=? AND idusergroup=?",
        [b.username, b.stationId],
      );
      if ((duplicates as any[]).length)
        throw new HttpError(409, "Tên tài khoản đã tồn tại trong trạm.");
      const [result] = await c.execute(
        "INSERT INTO tbusers (username,password,idusergroup,iduserrole,enable) VALUES (?,?,?,?,?)",
        [
          b.username,
          legacyHash(b.password),
          b.stationId,
          b.roleId,
          b.enabled ? 1 : 0,
        ],
      );
      const id = (result as any).insertId;
      await c.execute(
        "INSERT INTO mobile_user_access (user_id,view_all) VALUES (?,?)",
        [id, b.viewAll ? 1 : 0],
      );
      if (tables && accessTable)
        await setDurianRole(c, source, tables.has("mobile_station_config"), id, b.stationId, b.durianRole);
      const { password, ...safe } = b;
      await audit(c, req.user!.id, "create", "account", id, safe);
      return id;
    });
    res.status(201).json({ id, message: "Đã tạo tài khoản trạm cân." });
  }),
);
router.patch(
  "/accounts/:id",
  route(async (req, res) => {
    const source = managementSource(req);
    const id = idSchema.parse(req.params.id);
    const b = z
      .object({
        version: z.string().length(64),
        username: accountSchema.shape.username.optional(),
        stationId: idSchema.optional(),
        roleId: idSchema,
        enabled: z.boolean(),
        durianRole: accountSchema.shape.durianRole,
        viewAll: z
          .boolean()
          .optional()
          .transform(() => true),
        password: passwordSchema.optional(),
      })
      .parse(req.body);
    const tables = await sourceTables(source);
    const accessTable = tables.has("qhs_durian_user_access");
    if (b.durianRole && b.durianRole !== "none" && !accessTable)
      throw new HttpError(503, "Chưa sẵn sàng để cấp quyền sầu riêng.");
    await transaction(source, async (c) => {
      if (b.stationId) await requireStation(c, b.stationId);
      const [rows] = await c.execute(
        userSelect +
          ` WHERE u.id=? AND ${notArchived("account", "u.id")} FOR UPDATE`,
        [id],
      );
      const row = (rows as any[])[0];
      stale(row, b.version);
      const stationId = b.stationId ?? row.idusergroup;
      const username = b.username ?? row.username;
      if (
        source === "db1" && isCompanyAdmin(id, row.idusergroup) &&
        (stationId !== row.idusergroup || !b.enabled)
      )
        throw new HttpError(
          409,
          "Không thể chuyển trạm hoặc khóa tài khoản quản trị công ty.",
        );
      if (stationId !== row.idusergroup || username !== row.username) {
        const [duplicates] = await c.execute(
          "SELECT id FROM tbusers WHERE username=? AND idusergroup=? AND id<>?",
          [username, stationId, id],
        );
        if ((duplicates as unknown[]).length)
          throw new HttpError(409, "Tên tài khoản đã tồn tại trong trạm.");
      }
      const [roles] = await c.execute(
        "SELECT idtbusers_role FROM tbusers_role WHERE idtbusers_role=? AND enable=1",
        [b.roleId],
      );
      if (!(roles as any[]).length)
        throw new HttpError(400, "Vai trò không hợp lệ.");
      await c.execute(
        "UPDATE tbusers SET username=?,idusergroup=?,iduserrole=?,enable=?" +
          (b.password ? ",password=?" : "") +
          " WHERE id=?",
        b.password
          ? [
              username,
              stationId,
              b.roleId,
              b.enabled ? 1 : 0,
              legacyHash(b.password),
              id,
            ]
          : [username, stationId, b.roleId, b.enabled ? 1 : 0, id],
      );
      await c.execute(
        "INSERT INTO mobile_user_access (user_id,view_all) VALUES (?,?) ON DUPLICATE KEY UPDATE view_all=VALUES(view_all)",
        [id, b.viewAll ? 1 : 0],
      );
      if (accessTable)
        await setDurianRole(c, source, tables.has("mobile_station_config"), id, stationId, b.durianRole, row.idusergroup);
      await c.execute(
        `UPDATE ${sessionTable} SET revoked_at=NOW() WHERE subject_kind=? AND subject_id=?`,
        [source === "db1" ? "station" : "station2", id],
      );
      await audit(c, req.user!.id, "update", "account", id, {
        before: accountView(row),
        after: {
          roleId: b.roleId,
          stationId,
          username,
          durianRole: b.durianRole,
          enabled: b.enabled,
          viewAll: b.viewAll,
          passwordChanged: Boolean(b.password),
        },
      });
    });
    res.json({
      message: "Đã cập nhật tài khoản. Người dùng cần đăng nhập lại.",
    });
  }),
);
router.delete(
  "/accounts/:id",
  route(async (req, res) => {
    const source = managementSource(req);
    const id = idSchema.parse(req.params.id);
    const { version } = archiveSchema.parse(req.body);
    const accessTable = (await sourceTables(source)).has("qhs_durian_user_access");
    await transaction(source, async (c) => {
      const [rows] = await c.execute(
        userSelect +
          ` WHERE u.id=? AND ${notArchived("account", "u.id")} FOR UPDATE`,
        [id],
      );
      const account = (rows as any[])[0];
      stale(account, version);
      if (source === "db1" && isCompanyAdmin(id, account.idusergroup))
        throw new HttpError(409, "Không thể xóa tài khoản quản trị công ty.");
      await c.execute("UPDATE tbusers SET enable=0 WHERE id=?", [id]);
      if (accessTable) await setDurianRole(c, source, false, id, account.idusergroup, "none");
      await c.execute(
        `UPDATE ${sessionTable} SET revoked_at=NOW() WHERE subject_kind=? AND subject_id=?`,
        [source === "db1" ? "station" : "station2", id],
      );
      await audit(c, req.user!.id, "archive", "account", id, {
        before: accountView(account),
      });
    });
    res.json({ message: "Đã xóa tài khoản khỏi danh sách quản lý." });
  }),
);
router.get(
  "/audit",
  route(async (req, res) => {
    const f = listSchema.parse(req.query);
    const [items] = await dbFor(managementSource(req)).execute(
      `SELECT id,actor_id,action,entity,entity_id,detail,created_at FROM mobile_admin_audit ORDER BY id DESC LIMIT ${f.limit} OFFSET ${(f.page - 1) * f.limit}`,
    );
    res.json({ items });
  }),
);
export default router;
