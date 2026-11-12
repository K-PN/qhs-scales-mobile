import { test } from "node:test";
import assert from "node:assert/strict";
import { weighingScope, filters } from "../src/utils/weighings.js";
import { legacyHash, enabled, equalHash } from "../src/utils/security.js";
import { AppUser } from "../src/types/auth.js";
import { isCompanyAdmin } from "../src/config/access.js";
import { env } from "../src/config/env.js";
import { groupedReportQueries } from "../src/utils/report-groups.js";
const own: AppUser = {
  id: 12,
  username: "operator",
  fullName: "operator",
  role: "station",
  stationId: 7,
  stationName: "A",
  legacyRole: "Admin",
  viewAll: false,
  credential: "",
};
test("every station account sees its whole station and remains station-bound", () => {
  const s = weighingScope(own, { stationId: 9, creatorId: 99 });
  assert.deepEqual(s.params, [7, 99]);
  assert.match(s.sql, /w.idusergroup=\?/);
  assert.deepEqual(weighingScope(own).params, [7]);
});
test("company admin requires both explicit account and company station", () => {
  const config = { ...env, companyStationId: 1, companyAdminUserIds: [1] };
  assert.equal(isCompanyAdmin(1, 1, config), true);
  assert.equal(isCompanyAdmin(1, 2, config), false);
  assert.equal(isCompanyAdmin(2, 1, config), false);
  assert.equal(isCompanyAdmin(1, 1, { ...config, companyStationId: 0 }), false);
});
test("station-wide grant cannot escape its station", () => {
  const s = weighingScope(
    { ...own, viewAll: true },
    { stationId: 9, creatorId: 44 },
  );
  assert.deepEqual(s.params, [7, 44]);
});
test("provider can filter station and creator", () => {
  assert.deepEqual(
    weighingScope({ ...own, role: "admin" }, { stationId: 9, creatorId: 44 })
      .params,
    [9, 44],
  );
});
test("missing station fails closed", () => {
  assert.throws(() => weighingScope({ ...own, stationId: null }));
});
test("query text stays parameterized", () => {
  const s = weighingScope(own, { q: "' OR 1=1 --" });
  assert.ok(!s.sql.includes("OR 1=1"));
  assert.equal(s.params.length, 4);
});
test("invalid date and pagination are rejected", () => {
  for (const q of [
    { page: 0 },
    { limit: 1000 },
    { stationId: -1 },
    { startDate: "2026-02-30" },
    { startDate: "2026-10-17", endDate: "2026-10-01" },
  ])
    assert.equal(filters.safeParse(q).success, false);
});
test("legacy password hash matches desktop suffix and ASCII replacement", () => {
  assert.equal(legacyHash("123456"), "7E1801739DD9867835F666182B9E1B75");
  assert.equal(legacyHash("é"), legacyHash("?"));
  assert.equal(
    equalHash(legacyHash("123456"), legacyHash("123456").toLowerCase()),
    true,
  );
  assert.equal(equalHash("a", "aa"), false);
});
test("MySQL BIT zero is disabled", () => {
  assert.equal(enabled(Buffer.from([0])), false);
  assert.equal(enabled(Buffer.from([1])), true);
  assert.equal(enabled(0), false);
});

test("grouped reports enforce station scope and keep filters parameterized", () => {
  for (const groupBy of ["customer", "item", "vehicle"]) {
    const query = groupedReportQueries(own, {
      groupBy,
      stationId: 99,
      q: "' OR 1=1 --",
      startDate: "2026-10-01",
      limit: 10,
      page: 2,
    });
    assert.deepEqual(query.params, [
      7,
      ...Array(3).fill("%' OR 1=1 --%"),
      "2026-10-01",
    ]);
    assert.ok(!query.itemsSql.includes("OR 1=1"));
    assert.match(query.itemsSql, /LIMIT 10 OFFSET 10/);
    assert.match(query.countSql, /w.idusergroup=\?/);
  }
});

test("grouped reports reject arbitrary SQL grouping and invalid pagination", () => {
  for (const query of [
    { groupBy: "customer; DROP TABLE tbweight" },
    { groupBy: "item", limit: 101 },
    { groupBy: "vehicle", page: 0 },
  ]) {
    assert.throws(() => groupedReportQueries(own, query));
  }
});

test("group search matches only its dimension and preserves whole-group totals", () => {
  for (const [groupBy, count] of [
    ["customer", 2],
    ["item", 1],
    ["vehicle", 1],
  ] as const) {
    const query = groupedReportQueries(own, {
      groupBy,
      search: "  %_=' OR 1=1 --  ",
    });
    assert.deepEqual(query.params, [
      7,
      ...Array(count).fill("%=%=_==' OR 1==1 --%"),
    ]);
    assert.match(query.itemsSql, /GROUP BY[\s\S]*HAVING SUM\(CASE WHEN/);
    assert.match(query.countSql, /HAVING SUM\(CASE WHEN/);
    assert.ok(!query.itemsSql.includes("OR 1=1"));
  }
  assert.throws(() =>
    groupedReportQueries(own, { groupBy: "customer", search: "a".repeat(101) }),
  );
});
