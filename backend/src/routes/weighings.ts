import { Router } from "express";
import { z } from "zod";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { route, HttpError } from "../utils/http.js";
import { filters, weighingData, weighingScope, columns, joins } from "../utils/weighings.js";
const router = Router();
router.use(requireAuth, requirePermission("truck:read"));
router.get(
  "/",
  route(async (req, res) => {
    const f = filters.parse(req.query);
    const { db, user } = await weighingData(req.user!, f);
    const scope = weighingScope(user, f);
    // Validated integers are rendered as literals: avoids MySQL prepared LIMIT incompatibilities.
    const [items] = await db.execute(
      `SELECT ${columns} ${joins} WHERE ${scope.sql} ORDER BY w.date_in DESC,w.id DESC LIMIT ${f.limit} OFFSET ${(f.page - 1) * f.limit}`,
      scope.params,
    );
    const [count] = await db.execute(
      `SELECT COUNT(*) total FROM tbweight w WHERE ${scope.sql}`,
      scope.params,
    );
    res.json({
      items,
      total: Number((count as any[])[0].total),
      page: f.page,
      limit: f.limit,
    });
  }),
);
router.get(
  "/:id",
  route(async (req, res) => {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const f = filters.parse(req.query);
    const { db, user } = await weighingData(req.user!, f);
    const scope = weighingScope(user);
    const [rows] = await db.execute(
      `SELECT ${columns} ${joins} WHERE ${scope.sql} AND w.id=?`,
      [...scope.params, id],
    );
    if (!(rows as any[])[0])
      throw new HttpError(404, "Không tìm thấy phiếu cân.");
    res.json({ item: (rows as any[])[0] });
  }),
);
export default router;
