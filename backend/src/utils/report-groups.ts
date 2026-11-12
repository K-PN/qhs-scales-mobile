import { z } from "zod";
import { AppUser } from "../types/auth.js";
import { filters, weighingScope } from "./weighings.js";

export const groupBySchema = z.enum(["customer", "item", "vehicle"]);
export type ReportGroup = z.infer<typeof groupBySchema>;

// Use receipt snapshots. Customer IDs belong to a station, never to a global catalog.
const customerKey = `CONCAT(w.idusergroup,':',CASE
  WHEN NULLIF(TRIM(w.customer_id),'') IS NOT NULL THEN CONCAT('id:',TRIM(w.customer_id))
  WHEN NULLIF(TRIM(w.customer_name),'') IS NOT NULL THEN CONCAT('name:',LOWER(TRIM(w.customer_name)))
  ELSE 'unknown:' END)`;
const definitions = {
  customer: {
    key: customerKey,
    label:
      "COALESCE(NULLIF(TRIM(w.customer_name),''),NULLIF(TRIM(w.customer_id),''),'Chưa có khách hàng')",
  },
  item: {
    key: "LOWER(TRIM(COALESCE(w.items_name,'')))",
    label: "COALESCE(NULLIF(TRIM(w.items_name),''),'Chưa có hàng hóa')",
  },
  vehicle: {
    key: "UPPER(TRIM(COALESCE(w.truct_no,'')))",
    label: "COALESCE(NULLIF(UPPER(TRIM(w.truct_no)),''),'Chưa có biển số')",
  },
} as const;

export function groupedReportQueries(user: AppUser, query: unknown) {
  const f = filters.parse(query);
  const groupBy = groupBySchema.parse(
    (query as Record<string, unknown>).groupBy,
  );
  const group = definitions[groupBy];
  const scope = weighingScope(user, f);
  const search = z
    .string()
    .trim()
    .max(100)
    .default("")
    .parse((query as Record<string, unknown>).search);
  const searchColumns =
    groupBy === "customer"
      ? ["w.customer_name", "w.customer_id"]
      : groupBy === "item"
        ? ["w.items_name"]
        : ["w.truct_no"];
  const having = search
    ? ` HAVING SUM(CASE WHEN ${searchColumns.map((column) => `${column} LIKE ? ESCAPE '='`).join(" OR ")} THEN 1 ELSE 0 END)>0`
    : "";
  const searchParams = search
    ? searchColumns.map(() => "%" + search.replace(/[=%_]/g, "=$&") + "%")
    : [];
  const from = `FROM tbweight w LEFT JOIN tbusers_group g ON g.id=w.idusergroup WHERE ${scope.sql}`;
  return {
    groupBy,
    page: f.page,
    limit: f.limit,
    params: [...scope.params, ...searchParams],
    itemsSql: `SELECT ${group.key} groupKey,MAX(${group.label}) label,
      ${groupBy === "customer" ? "MAX(g.name)" : "NULL"} stationName,
      COUNT(*) records,COALESCE(SUM(w.net_weight),0) weight,
      COALESCE(SUM(w.price_total),0) revenue,
      COALESCE(SUM(w.weight_2 IS NULL),0) pending
      ${from} GROUP BY ${group.key}${having}
      ORDER BY revenue DESC,records DESC,groupKey ASC
      LIMIT ${f.limit} OFFSET ${(f.page - 1) * f.limit}`,
    countSql: `SELECT COUNT(*) total FROM (SELECT ${group.key} groupKey ${from} GROUP BY ${group.key}${having}) grouped_rows`,
  };
}
