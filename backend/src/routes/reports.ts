import { Router } from "express";
import { dbFor } from "../config/db.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { route } from "../utils/http.js";
import { filters, weighingData, weighingScope } from "../utils/weighings.js";
import { groupedReportQueries } from "../utils/report-groups.js";
import { notArchived } from "../config/access.js";
const router = Router();
router.use(requireAuth, requirePermission("truck:read"));
router.get(
  "/groups",
  route(async (req, res) => {
    const { db, user } = await weighingData(req.user!, filters.parse(req.query));
    const query = groupedReportQueries(user, req.query);
    const [items] = await db.execute(query.itemsSql, query.params);
    const [count] = await db.execute(query.countSql, query.params);
    res.json({
      items,
      total: Number((count as { total: number }[])[0].total),
      page: query.page,
      limit: query.limit,
      groupBy: query.groupBy,
    });
  }),
);
router.get(
  "/",
  route(async (req, res) => {
    const f = filters.parse(req.query);
    const { db, user } = await weighingData(req.user!, f);
    const scope = weighingScope(user, f);
    const [rows] = await db.execute(
      `SELECT COUNT(*) totalRecords,COALESCE(SUM(w.net_weight),0) totalNet,
    COALESCE(SUM(w.weight_2 IS NULL),0) pending,COALESCE(SUM(w.weight_2 IS NOT NULL),0) complete,
    COALESCE(SUM(w.price_total),0) revenue,
    COUNT(DISTINCT CASE WHEN NULLIF(TRIM(w.customer_id),'') IS NOT NULL THEN CONCAT(w.idusergroup,':id:',TRIM(w.customer_id))
      WHEN NULLIF(TRIM(w.customer_name),'') IS NOT NULL THEN CONCAT(w.idusergroup,':name:',LOWER(TRIM(w.customer_name))) END) customers,
    COUNT(DISTINCT NULLIF(TRIM(w.truct_no),'')) vehicles
    FROM tbweight w WHERE ${scope.sql}`,
      scope.params,
    );
    const trendEnd =
      f.endDate ||
      new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
    const trendStart =
      f.startDate ||
      new Date(Date.parse(trendEnd) - 6 * 86400000).toISOString().slice(0, 10);
    const dayCount =
      (Date.parse(trendEnd) - Date.parse(trendStart)) / 86400000 + 1;
    const trendUnit =
      dayCount <= 31 ? "day" : dayCount <= 731 ? "month" : "year";
    const trendDay =
      trendUnit === "day"
        ? "DATE(w.date_in)"
        : trendUnit === "month"
          ? "DATE_FORMAT(w.date_in,'%Y-%m-01')"
          : "DATE_FORMAT(w.date_in,'%Y-01-01')";
    const trendScope = weighingScope(user, {
      ...f,
      startDate: trendStart,
      endDate: trendEnd,
    });
    const [trend] = await db.execute(
      `SELECT ${trendDay} day,COUNT(*) records,COALESCE(SUM(w.net_weight),0) weight
    FROM tbweight w WHERE ${trendScope.sql}
    GROUP BY ${trendDay} ORDER BY day`,
      trendScope.params,
    );
    const today = weighingScope(user, { stationId: f.stationId });
    const [todayRows] = await db.execute(
      `SELECT COUNT(*) records,COALESCE(SUM(w.net_weight),0) weight,COALESCE(SUM(w.price_total),0) revenue FROM tbweight w
    WHERE ${today.sql} AND w.date_in>=CURDATE() AND w.date_in<DATE_ADD(CURDATE(),INTERVAL 1 DAY)`,
      today.params,
    );
    let system;
    if (req.user!.role === "admin") {
      const managementDb = dbFor(f.source);
      const [s] = await managementDb.execute(
        `SELECT COUNT(*) stations,COALESCE(SUM(enable=1),0) activeStations FROM tbusers_group WHERE ${notArchived("station", "tbusers_group.id")}`,
      );
      const [a] = await managementDb.execute(`SELECT COUNT(*) accounts FROM tbusers WHERE ${notArchived("account", "tbusers.id")}`);
      system = { ...(s as any[])[0], ...(a as any[])[0] };
    }
    res.json({
      summary: (rows as any[])[0],
      today: (todayRows as any[])[0],
      trend,
      trendUnit,
      system,
    });
  }),
);
export default router;
