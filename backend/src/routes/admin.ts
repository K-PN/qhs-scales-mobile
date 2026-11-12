import { Router } from "express";
import { z } from "zod";
import { PoolConnection } from "mysql2/promise";
import { db } from "../config/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { enabled, fingerprint, legacyHash } from "../utils/security.js";
import { route, HttpError } from "../utils/http.js";
const router = Router();
router.use(requireAuth, requireRole("admin"));
const idSchema = z.coerce.number().int().positive();
const listSchema = z.object({
  q: z.string().trim().max(100).default(""),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  stationId: idSchema.optional(),
});
const stationSchema = z.object({
  name: z.string().trim().min(1).max(100),
  address: z.string().trim().max(255),
  phonenumber: z.string().trim().max(255),
  enabled: z.boolean(),
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
const userSelect = `SELECT u.*,r.name role_name,COALESCE(a.view_all,0) view_all FROM tbusers u
 LEFT JOIN tbusers_role r ON r.idtbusers_role=u.iduserrole LEFT JOIN mobile_user_access a ON a.user_id=u.id`;
function stationView(row: any) {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    phonenumber: row.phonenumber,
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
    roleId: row.iduserrole,
    roleName: row.role_name,
    enabled: enabled(row.enable),
    viewAll: true,
    version: fingerprint(row),
  };
}
async function transaction<T>(work: (c: PoolConnection) => Promise<T>) {
  const c = await db.getConnection();
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
router.get(
  "/stations",
  route(async (req, res) => {
    const f = listSchema.parse(req.query),
      search = "%" + f.q + "%";
    const where = "WHERE (?='' OR name LIKE ? OR phonenumber LIKE ?)";
    const [rows] = await db.execute(
      `SELECT * FROM tbusers_group ${where} ORDER BY id DESC LIMIT ${f.limit} OFFSET ${(f.page - 1) * f.limit}`,
      [f.q, search, search],
    );
    const [count] = await db.execute(
      `SELECT COUNT(*) total FROM tbusers_group ${where}`,
      [f.q, search, search],
    );
    res.json({
      items: (rows as any[]).map(stationView),
      total: Number((count as any[])[0].total),
      page: f.page,
      limit: f.limit,
    });
  }),
);
router.post(
  "/stations",
  route(async (req, res) => {
    const b = stationSchema.parse(req.body);
    const id = await transaction(async (c) => {
      const [result] = await c.execute(
        `INSERT INTO tbusers_group
   (name,address,phonenumber,lastid,startdate,enddate,sign_1,sign_2,sign_3,sign_4,idweight_apptype,idapp_types,enable)
   VALUES (?,?,?,0,NULL,NULL,NULL,NULL,NULL,NULL,1,1,?)`,
        [b.name, b.address, b.phonenumber, b.enabled ? 1 : 0],
      );
      const id = (result as any).insertId;
      await audit(c, req.user!.id, "create", "station", id, b);
      return id;
    });
    res.status(201).json({ id, message: "Đã tạo trạm cân." });
  }),
);
router.patch(
  "/stations/:id",
  route(async (req, res) => {
    const id = idSchema.parse(req.params.id),
      b = stationSchema
        .extend({ version: z.string().length(64) })
        .parse(req.body);
    await transaction(async (c) => {
      const [rows] = await c.execute(
        "SELECT * FROM tbusers_group WHERE id=? FOR UPDATE",
        [id],
      );
      stale((rows as any[])[0], b.version);
      await c.execute(
        "UPDATE tbusers_group SET name=?,address=?,phonenumber=?,enable=? WHERE id=?",
        [b.name, b.address, b.phonenumber, b.enabled ? 1 : 0, id],
      );
      await c.execute(
        "UPDATE mobile_sessions s JOIN tbusers u ON u.id=s.subject_id SET s.revoked_at=NOW() WHERE s.subject_kind='station' AND u.idusergroup=?",
        [id],
      );
      await audit(c, req.user!.id, "update", "station", id, {
        before: stationView((rows as any[])[0]),
        after: {
          name: b.name,
          address: b.address,
          phonenumber: b.phonenumber,
          enabled: b.enabled,
        },
      });
    });
    res.json({ message: "Đã cập nhật trạm cân." });
  }),
);
router.get(
  "/roles",
  route(async (_req, res) => {
    const [rows] = await db.execute(
      "SELECT idtbusers_role id,name FROM tbusers_role WHERE enable=1 ORDER BY idtbusers_role",
    );
    res.json({ items: rows });
  }),
);
router.get(
  "/accounts",
  route(async (req, res) => {
    const f = listSchema.parse(req.query),
      params: any[] = ["%" + f.q + "%"];
    const where =
      " WHERE u.username LIKE ?" + (f.stationId ? " AND u.idusergroup=?" : "");
    if (f.stationId) params.push(f.stationId);
    const [rows] = await db.execute(
      `${userSelect}${where} ORDER BY u.id DESC LIMIT ${f.limit} OFFSET ${(f.page - 1) * f.limit}`,
      params,
    );
    const [count] = await db.execute(
      "SELECT COUNT(*) total FROM tbusers u" + where,
      params,
    );
    res.json({
      items: (rows as any[]).map(accountView),
      total: Number((count as any[])[0].total),
      page: f.page,
      limit: f.limit,
    });
  }),
);
router.post(
  "/accounts",
  route(async (req, res) => {
    const b = accountSchema
      .extend({ stationId: idSchema, password: passwordSchema })
      .parse(req.body);
    const id = await transaction(async (c) => {
      const [stations] = await c.execute(
        "SELECT id FROM tbusers_group WHERE id=? FOR UPDATE",
        [b.stationId],
      );
      if (!(stations as any[]).length)
        throw new HttpError(404, "Trạm cân không tồn tại.");
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
    const id = idSchema.parse(req.params.id);
    const b = z
      .object({
        version: z.string().length(64),
        roleId: idSchema,
        enabled: z.boolean(),
        viewAll: z
          .boolean()
          .optional()
          .transform(() => true),
        password: passwordSchema.optional(),
      })
      .parse(req.body);
    await transaction(async (c) => {
      await c.execute(
        "INSERT IGNORE INTO mobile_user_access (user_id,view_all) SELECT id,0 FROM tbusers WHERE id=?",
        [id],
      );
      const [rows] = await c.execute(userSelect + " WHERE u.id=? FOR UPDATE", [
        id,
      ]);
      const row = (rows as any[])[0];
      stale(row, b.version);
      const [roles] = await c.execute(
        "SELECT idtbusers_role FROM tbusers_role WHERE idtbusers_role=? AND enable=1",
        [b.roleId],
      );
      if (!(roles as any[]).length)
        throw new HttpError(400, "Vai trò không hợp lệ.");
      await c.execute(
        "UPDATE tbusers SET iduserrole=?,enable=?" +
          (b.password ? ",password=?" : "") +
          " WHERE id=?",
        b.password
          ? [b.roleId, b.enabled ? 1 : 0, legacyHash(b.password), id]
          : [b.roleId, b.enabled ? 1 : 0, id],
      );
      await c.execute(
        "UPDATE mobile_user_access SET view_all=? WHERE user_id=?",
        [b.viewAll ? 1 : 0, id],
      );
      await c.execute(
        "UPDATE mobile_sessions SET revoked_at=NOW() WHERE subject_kind='station' AND subject_id=?",
        [id],
      );
      await audit(c, req.user!.id, "update", "account", id, {
        before: accountView(row),
        after: {
          roleId: b.roleId,
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
router.get(
  "/audit",
  route(async (req, res) => {
    const f = listSchema.parse(req.query);
    const [items] = await db.execute(
      `SELECT id,actor_id,action,entity,entity_id,detail,created_at FROM mobile_admin_audit ORDER BY id DESC LIMIT ${f.limit} OFFSET ${(f.page - 1) * f.limit}`,
    );
    res.json({ items });
  }),
);
export default router;
