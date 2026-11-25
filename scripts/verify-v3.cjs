// Isolated integration verification. Never reads backend/.env or imports dump data.
// Requires a disposable MariaDB on 127.0.0.1:3317. Creates a fresh test-only database.
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path");
const { spawn } = require("node:child_process");
const mysql = require("mysql2/promise"),
  bcrypt = require("bcryptjs"),
  crypto = require("node:crypto");
const root = path.resolve(__dirname, "..");
const database = "qhs_mobile_test_" + Date.now(),
  port = 4027;
let server, connection, browser;
const logs = [];
const checks = [];
const hash = (p) =>
  crypto
    .createHash("md5")
    .update(p + "@haiviet", "ascii")
    .digest("hex")
    .toUpperCase();
async function call(url, token, method = "GET", body) {
  const response = await fetch("http://127.0.0.1:" + port + url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => null);
  return { status: response.status, data };
}
function check(name, actual, expected) {
  assert.deepEqual(actual, expected, name);
  checks.push(name);
}
async function login(kind, username, password) {
  const r = await call("/auth/login", null, "POST", {
    kind,
    username,
    password,
  });
  check("login " + username, r.status, 200);
  return r.data;
}
(async () => {
  assert.match(database, /^qhs_mobile_test_\d+$/);
  connection = await mysql.createConnection({
    host: "127.0.0.1",
    port: 3317,
    user: "root",
    password: process.env.QHS_TEST_DB_PASSWORD || "test-root-only",
    multipleStatements: true,
  });
  await connection.query(
    "CREATE DATABASE " +
      database +
      " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
  );
  await connection.changeUser({ database });
  await connection.query("SET time_zone = ' +07:00'".replace(" +", "+"));
  const dump = fs.readFileSync(
    path.join(root, "can15657_canquochung_2026-08-27_03-29-58.sql"),
    "utf8",
  );
  for (const name of [
    "tbusers_group",
    "tbusers_role",
    "tbusers",
    "tbweight",
    "tbapp_types",
    "tbweight_apptype",
  ]) {
    const start = dump.indexOf("CREATE TABLE `" + name + "` (");
    assert.ok(start >= 0);
    const end = dump.indexOf(";", start);
    await connection.query(dump.slice(start, end + 1));
  }
  await connection.query(
    fs
      .readFileSync(
        path.join(root, "backend/database/auth-migration.sql"),
        "utf8",
      )
      .replace(/^\uFEFF/, ""),
  );
  await connection.query(
    fs
      .readFileSync(path.join(root, "backend/database/mobile-v2.sql"), "utf8")
      .replace(/^\uFEFF/, ""),
  );
  await connection.query(
    "INSERT INTO tbusers_role (idtbusers_role,name,administration,enable) VALUES (1,'Admin',1,1),(4,'Quản lý',0,1),(5,'Trạm cân',0,1)",
  );
  for (const [id, name] of [
    [1, "Trạm cân An Phú"],
    [2, "Trạm cân Bình Minh"],
  ])
    await connection.execute(
      "INSERT INTO tbusers_group (id,name,address,phonenumber,lastid,idweight_apptype,idapp_types,enable) VALUES (?,?,?,?,0,1,1,1)",
      [id, name, "Đắk Lắk", "0900000000"],
    );
  for (const [id, username, group, role] of [
    [11, "operatorA", 1, 5],
    [12, "managerA", 1, 4],
    [13, "localadmin", 1, 1],
    [21, "operatorB", 2, 5],
    [22, "otheradmin", 2, 1],
  ])
    await connection.execute(
      "INSERT INTO tbusers (id,username,password,idusergroup,iduserrole,enable) VALUES (?,?,?,?,?,1)",
      [id, username, hash("Station-test-123"), group, role],
    );
  await connection.execute(
    "INSERT INTO app_users (id,email,password_hash,full_name,role,status) VALUES (1,'provider@test.local',?,'Quản trị QHS','admin',1)",
    [await bcrypt.hash("Provider-test-123", 10)],
  );
  for (const [id, creator, group, weight, active] of [
    [501, 11, 1, 1000, 1],
    [502, 12, 1, 2000, 1],
    [503, 21, 2, 3000, 1],
    [504, 11, 2, 4000, 1],
    [505, 11, 1, null, 1],
    [506, 11, 1, 9000, 0],
  ]) {
    await connection.execute(
      `INSERT INTO tbweight (id,formcode,truct_no,customer_name,items_name,date_in,weight_1,weight_2,net_weight,createby,createtime,idusergroup,enable)
   VALUES (?,?,?,'Công ty Minh Anh','Cà phê',NOW(),10000,?,?,?,NOW(),?,?)`,
      [
        id,
        "PC" + id,
        "47C-123.45",
        weight === null ? null : 10000 - weight,
        weight,
        creator,
        group,
        active,
      ],
    );
  }
  await connection.query(
    "UPDATE tbweight SET price_total=CASE id WHEN 501 THEN 10000 WHEN 502 THEN 20000 WHEN 503 THEN 40000 WHEN 504 THEN 50000 WHEN 505 THEN 30000 ELSE 99000 END",
  );
  const env = {
    ...process.env,
    PORT: String(port),
    DB_HOST: "127.0.0.1",
    DB_PORT: "3317",
    DB_USER: "root",
    DB_PASSWORD: process.env.QHS_TEST_DB_PASSWORD || "test-root-only",
    DB_NAME: database,
    JWT_ACCESS_SECRET: "isolated-test-key-123456789012345678901234567890",
    CLIENT_URL: "http://localhost:8088",
    NODE_ENV: "test",
    QHS_COMPANY_STATION_ID: "1",
    QHS_COMPANY_ADMIN_USER_IDS: "13",
  };
  server = spawn(
    process.execPath,
    ["--import", "tsx", "backend/src/server.ts"],
    { cwd: root, env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
  );
  for (const stream of [server.stdout, server.stderr])
    stream.on("data", (d) => logs.push(d.toString()));
  for (let i = 0; i < 80; i++) {
    try {
      if ((await call("/health")).status === 200) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }

  check("health", (await call("/health")).status, 200);
  const unknownApi = await call("/not-a-route");
  check("unknown API returns JSON 404", unknownApi.status, 404);
  check(
    "unknown API has a readable JSON message",
    typeof unknownApi.data?.message,
    "string",
  );
  const own = await login("station", "operatorA", "Station-test-123");
  const other = await login("station", "operatorB", "Station-test-123");
  const admin = await login("station", "localadmin", "Station-test-123");
  const rogue = await login("station", "otheradmin", "Station-test-123");
  const provider = await login(
    "admin",
    "provider@test.local",
    "Provider-test-123",
  );
  check(
    "company administrator detected automatically",
    admin.user.role,
    "admin",
  );
  check(
    "company administrator remains linked to company station",
    admin.user.stationId,
    1,
  );
  check(
    "other station Admin cannot administer system",
    rogue.user.role,
    "station",
  );
  check(
    "ordinary company-station account remains ordinary",
    own.user.role,
    "station",
  );
  check("station-wide policy active", own.user.viewAll, true);
  check(
    "station sees other operators",
    (await call("/weighings", own.accessToken)).data.items
      .map((w) => w.id)
      .sort(),
    [501, 502, 505],
  );
  check(
    "other station scope",
    (await call("/weighings", other.accessToken)).data.items
      .map((w) => w.id)
      .sort(),
    [503, 504],
  );
  check(
    "filter cannot change station",
    (await call("/weighings?stationId=2", own.accessToken)).data.total,
    3,
  );
  check(
    "creator filter only narrows",
    (await call("/weighings?creatorId=12", own.accessToken)).data.total,
    1,
  );
  check(
    "foreign creator cannot escape station",
    (await call("/weighings?stationId=2&creatorId=21", own.accessToken)).data
      .total,
    0,
  );
  check(
    "same station detail visible",
    (await call("/weighings/502", own.accessToken)).status,
    200,
  );
  check(
    "cross station detail hidden",
    (await call("/weighings/503", own.accessToken)).status,
    404,
  );
  check(
    "disabled slip hidden",
    (await call("/weighings/506", own.accessToken)).status,
    404,
  );
  check(
    "company admin global scope",
    (await call("/weighings", admin.accessToken)).data.total,
    5,
  );
  check(
    "company admin can list stations",
    (await call("/admin/stations", admin.accessToken)).status,
    200,
  );
  check(
    "ordinary user cannot manage",
    (await call("/admin/accounts", own.accessToken)).status,
    403,
  );
  check(
    "other station Admin cannot manage",
    (await call("/admin/stations", rogue.accessToken)).status,
    403,
  );
  const report = (await call("/reports", own.accessToken)).data;
  check(
    "station revenue sums stored amounts",
    Number(report.summary.revenue),
    60000,
  );
  check(
    "revenue excludes other station",
    Number((await call("/reports", other.accessToken)).data.summary.revenue),
    90000,
  );
  check(
    "customers counted within station",
    Number(report.summary.customers),
    1,
  );
  check("vehicle count", Number(report.summary.vehicles), 1);
  check(
    "company admin revenue all stations",
    Number((await call("/reports", admin.accessToken)).data.summary.revenue),
    150000,
  );
  check(
    "grouped report requires authentication",
    (await call("/reports/groups?groupBy=customer")).status,
    401,
  );
  check(
    "grouped report rejects arbitrary grouping",
    (await call("/reports/groups?groupBy=bad", own.accessToken)).status,
    400,
  );
  for (const groupBy of ["customer", "item", "vehicle"]) {
    const grouped = await call(
      "/reports/groups?groupBy=" + groupBy + "&stationId=2",
      own.accessToken,
    );
    check(groupBy + " grouped API status", grouped.status, 200);
    check(groupBy + " grouped station scope", grouped.data.total, 1);
    check(
      groupBy + " grouped records exclude disabled/foreign receipts",
      Number(grouped.data.items[0].records),
      3,
    );
    check(
      groupBy + " grouped revenue matches summary",
      Number(grouped.data.items[0].revenue),
      60000,
    );
    check(
      groupBy + " grouped date filter",
      (
        await call(
          "/reports/groups?groupBy=" + groupBy + "&endDate=1900-01-01",
          own.accessToken,
        )
      ).data.total,
      0,
    );
  }
  await connection.query("UPDATE tbweight SET customer_id='shared'");
  await connection.query(
    "UPDATE tbweight SET customer_name='Tên khách trước đây' WHERE id=501",
  );
  const renamedCustomer = (
    await call(
      "/reports/groups?groupBy=customer&search=" +
        encodeURIComponent("trước đây"),
      own.accessToken,
    )
  ).data;
  check(
    "customer snapshot search retains entire matching group",
    Number(renamedCustomer.items[0].revenue),
    60000,
  );
  check(
    "customer code search",
    (
      await call(
        "/reports/groups?groupBy=customer&search=shared",
        own.accessToken,
      )
    ).data.total,
    1,
  );
  await connection.query(
    "UPDATE tbweight SET customer_name='Công ty Minh Anh' WHERE id=501",
  );
  check(
    "customer codes stay station-bound",
    (await call("/reports/groups?groupBy=customer", admin.accessToken)).data
      .total,
    2,
  );
  const firstGroup = (
    await call("/reports/groups?groupBy=customer&limit=1", admin.accessToken)
  ).data;
  const secondGroup = (
    await call(
      "/reports/groups?groupBy=customer&limit=1&page=2",
      admin.accessToken,
    )
  ).data;
  check("group count precedes pagination", firstGroup.total, 2);
  check(
    "group pagination returns distinct rows",
    firstGroup.items[0].groupKey !== secondGroup.items[0].groupKey,
    true,
  );
  await connection.query(
    "UPDATE tbweight SET customer_id='other' WHERE id=502",
  );
  check(
    "same name with distinct customer codes stays separate",
    (await call("/reports/groups?groupBy=customer", own.accessToken)).data
      .total,
    2,
  );
  await connection.query("UPDATE tbweight SET customer_id=''");
  await connection.query("UPDATE tbweight SET truct_no='47C-123'");
  await connection.query(
    "UPDATE tbweight SET items_name=' cà phê ',truct_no=' 47c-123 ' WHERE id=502",
  );
  for (const groupBy of ["item", "vehicle"]) {
    check(
      groupBy + " normalizes case and surrounding whitespace",
      (await call("/reports/groups?groupBy=" + groupBy, own.accessToken)).data
        .total,
      1,
    );
  }
  await connection.query(
    "UPDATE tbweight SET customer_name='',items_name='',truct_no='' WHERE id=505",
  );
  for (const groupBy of ["customer", "item", "vehicle"]) {
    const grouped = (
      await call("/reports/groups?groupBy=" + groupBy, own.accessToken)
    ).data;
    check(groupBy + " retains missing values as a group", grouped.total, 2);
    check(
      groupBy + " missing values preserve total revenue",
      grouped.items.reduce((sum, row) => sum + Number(row.revenue), 0),
      60000,
    );
  }
  await connection.query(
    "UPDATE tbweight SET customer_name='Công ty Minh Anh',items_name='Cà phê',truct_no='47C-123.45' WHERE id IN (502,505)",
  );
  await connection.query("UPDATE tbweight SET truct_no='47C-123.45'");
  for (const [groupBy, search] of [
    ["customer", "Minh Anh"],
    ["item", "Cà phê"],
    ["vehicle", "47c-123"],
  ]) {
    const matched = (
      await call(
        "/reports/groups?groupBy=" +
          groupBy +
          "&search=" +
          encodeURIComponent(search),
        own.accessToken,
      )
    ).data;
    check(groupBy + " search matches correct dimension", matched.total, 1);
    check(
      groupBy + " search retains stored amount",
      Number(matched.items[0].revenue),
      60000,
    );
    check(
      groupBy + " search no results",
      (
        await call(
          "/reports/groups?groupBy=" + groupBy + "&search=absent-search",
          own.accessToken,
        )
      ).data.total,
      0,
    );
    check(
      groupBy + " search treats wildcards literally",
      (
        await call(
          "/reports/groups?groupBy=" + groupBy + "&search=%25",
          own.accessToken,
        )
      ).data.total,
      0,
    );
  }
  check(
    "goods search does not search customer names",
    (await call("/reports/groups?groupBy=item&search=Minh", own.accessToken))
      .data.total,
    0,
  );
  await connection.query(
    "UPDATE tbweight SET date_in=CASE id WHEN 501 THEN '2026-01-01 00:00:00' WHEN 502 THEN '2026-01-02 23:59:59' ELSE '2026-01-03 00:00:00' END",
  );
  const boundedReport = (
    await call(
      "/reports?startDate=2026-01-01&endDate=2026-01-02",
      own.accessToken,
    )
  ).data;
  check(
    "overview custom range includes both boundary days",
    Number(boundedReport.summary.revenue),
    30000,
  );
  check(
    "overview chart follows custom period",
    boundedReport.trend.map((row) => String(row.day).slice(0, 10)),
    ["2026-01-01", "2026-01-02"],
  );
  check(
    "chart preserves summary weight",
    boundedReport.trend.reduce((sum, row) => sum + Number(row.weight), 0),
    Number(boundedReport.summary.totalNet),
  );
  check(
    "grouped search follows custom range",
    Number(
      (
        await call(
          "/reports/groups?groupBy=item&search=" +
            encodeURIComponent("Cà phê") +
            "&startDate=2026-01-01&endDate=2026-01-02",
          own.accessToken,
        )
      ).data.items[0].revenue,
    ),
    30000,
  );
  check(
    "long overview period groups chart by month",
    (
      await call(
        "/reports?startDate=2026-01-01&endDate=2026-12-31",
        own.accessToken,
      )
    ).data.trendUnit,
    "month",
  );
  check(
    "multi-year overview groups chart by year",
    (
      await call(
        "/reports?startDate=2020-01-01&endDate=2026-12-31",
        own.accessToken,
      )
    ).data.trendUnit,
    "year",
  );
  check(
    "overview rejects reversed date range",
    (
      await call(
        "/reports?startDate=2026-01-03&endDate=2026-01-01",
        own.accessToken,
      )
    ).status,
    400,
  );
  await connection.query("UPDATE tbweight SET date_in=NOW()");
  check(
    "company admin station profile",
    (await call("/station/profile", admin.accessToken)).data.station.id,
    1,
  );
  check(
    "station profile",
    (await call("/station/profile", own.accessToken)).data.station.id,
    1,
  );
  check(
    "admin refresh retains elevated role",
    (
      await call("/auth/refresh", null, "POST", {
        refreshToken: admin.refreshToken,
      })
    ).data.user.role,
    "admin",
  );
  check(
    "admin refresh uses legacy account source",
    (await call("/auth/me", admin.accessToken)).data.user.username,
    "localadmin",
  );
  check(
    "invalid pagination",
    (await call("/weighings?limit=999", own.accessToken)).status,
    400,
  );
  check(
    "invalid dates",
    (await call("/weighings?startDate=2026-02-30", own.accessToken)).status,
    400,
  );
  check(
    "Excel stays removed",
    (await call("/reports/excel", own.accessToken)).status,
    404,
  );
  check(
    "PDF stays removed",
    (await call("/reports/pdf", own.accessToken)).status,
    404,
  );
  check(
    "invalid credentials",
    (
      await call("/auth/login", null, "POST", {
        username: "operatorA",
        password: "invalid",
      })
    ).status,
    401,
  );
  await connection.execute(
    "INSERT INTO tbusers (id,username,password,idusergroup,iduserrole,enable) VALUES (31,?,?,?,?,1)",
    ["operatorA", hash("Station-test-123"), 2, 5],
  );
  check(
    "ambiguous login asks station",
    (
      await call("/auth/login", null, "POST", {
        username: "operatorA",
        password: "Station-test-123",
      })
    ).status,
    409,
  );
  check(
    "station id resolves ambiguity",
    (
      await call("/auth/login", null, "POST", {
        username: "operatorA",
        password: "Station-test-123",
        stationId: 1,
      })
    ).data.user.stationId,
    1,
  );
  await connection.execute("DELETE FROM tbusers WHERE id=31");
  const account = (
    await call("/admin/accounts?stationId=1", admin.accessToken)
  ).data.items.find((a) => a.id === 11);
  check("account UI permission is always station-wide", account.viewAll, true);
  check(
    "edit account",
    (
      await call("/admin/accounts/11", admin.accessToken, "PATCH", {
        version: account.version,
        roleId: 5,
        enabled: true,
      })
    ).status,
    200,
  );
  check(
    "stale edit",
    (
      await call("/admin/accounts/11", admin.accessToken, "PATCH", {
        version: account.version,
        roleId: 5,
        enabled: true,
      })
    ).status,
    409,
  );
  check(
    "old session revoked after edit",
    (await call("/weighings", own.accessToken)).status,
    401,
  );
  await login("station", "operatorA", "Station-test-123");

  if (process.env.PLAYWRIGHT_PATH) {
    const { chromium } = require(process.env.PLAYWRIGHT_PATH);
    browser = await chromium.launch({
      executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
      headless: true,
    });
    const dir = path.join(root, "artifacts/v3");
    fs.mkdirSync(dir, { recursive: true });
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      timezoneId: "Asia/Bangkok",
    });
    const page = await context.newPage(),
      errors = [];
    let groupedRequests = 0;
    page.on("request", (request) => {
      if (request.url().includes("/reports/groups?")) groupedRequests++;
    });
    async function verifyTabLabels(role) {
      for (const size of [
        { width: 320, height: 568 },
        { width: 390, height: 844 },
        { width: 812, height: 375 },
        { width: 1440, height: 1000 },
      ]) {
        await page.setViewportSize(size);
        await page.waitForTimeout(150);
        const clipped = await page.getByRole("tab").evaluateAll((tabs) =>
          tabs.flatMap((tab) => {
            const walker = document.createTreeWalker(tab, NodeFilter.SHOW_TEXT);
            const problems = [];
            let node;
            while ((node = walker.nextNode())) {
              if (!/[A-Za-zÀ-ỹ]/.test(node.textContent || "")) continue;
              const range = document.createRange();
              range.selectNodeContents(node);
              const rect = range.getBoundingClientRect(),
                bounds = tab.getBoundingClientRect();
              if (
                rect.bottom > bounds.bottom + 1 ||
                rect.top < bounds.top - 1 ||
                rect.left < bounds.left - 1 ||
                rect.right > bounds.right + 1 ||
                rect.bottom > window.innerHeight ||
                node.parentElement.scrollWidth >
                  node.parentElement.clientWidth + 1
              )
                problems.push(node.textContent);
            }
            return problems;
          }),
        );
        check(
          role + " tab labels fit " + size.width + "x" + size.height,
          clipped,
          [],
        );
        await page.screenshot({
          path: path.join(dir, role + "-tabs-" + size.width + ".png"),
        });
      }
      await page.setViewportSize({ width: 390, height: 844 });
    }
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("http://localhost:4010/**", (route) =>
      route.continue({
        url: route
          .request()
          .url()
          .replace("http://localhost:4010", "http://127.0.0.1:" + port),
      }),
    );
    await page.goto("http://localhost:8088", {
      waitUntil: "networkidle",
      timeout: 90000,
    });
    check(
      "no login mode selector",
      await page
        .getByRole("button", { name: "Quản trị QHS", exact: true })
        .count(),
      0,
    );
    check(
      "login privacy links to published policy",
      await page
        .getByRole("link", { name: "Chính sách quyền riêng tư", exact: true })
        .getAttribute("href"),
      "https://www.doluongquochung.com/privacy-policies/qhs-scales",
    );
    await page.goto("http://localhost:8088/privacy-policy");
    await page
      .getByText("1. Đơn vị phụ trách và phạm vi áp dụng", { exact: true })
      .waitFor();
    check(
      "privacy opens before login",
      new URL(page.url()).pathname,
      "/privacy-policy",
    );
    check(
      "privacy contact email",
      await page
        .getByRole("link", { name: "info@candientuquochung.com", exact: true })
        .count(),
      1,
    );
    await page.setViewportSize({ width: 320, height: 568 });
    check(
      "privacy page fits narrow screen",
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      true,
    );
    await page.screenshot({ path: path.join(dir, "privacy-policy-320.png") });
    await page.getByRole("button", { name: "Quay lại", exact: true }).click();
    await page.getByLabel("Tài khoản", { exact: true }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByLabel("Tài khoản", { exact: true }).fill("operatorA");
    await page.getByLabel("Mật khẩu", { exact: true }).fill("Station-test-123");
    await page.screenshot({ path: path.join(dir, "login-mobile.png") });
    await page
      .getByRole("button", { name: "Hiện mật khẩu", exact: true })
      .click();
    check(
      "password reveal",
      await page.getByLabel("Mật khẩu", { exact: true }).getAttribute("type"),
      "text",
    );
    await page
      .getByRole("button", { name: "Ẩn mật khẩu", exact: true })
      .click();
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await page.getByText("Thành tiền", { exact: true }).waitFor();
    await page.getByText("60.000", { exact: false }).first().waitFor();
    check("grouped statistics load only on demand", groupedRequests, 0);
    await page
      .getByRole("button", { name: "Xem thống kê", exact: true })
      .click();
    await page.getByText("Thành tiền: 60.000 đ", { exact: true }).waitFor();
    for (const [label, value] of [
      ["Hàng hóa", "Cà phê"],
      ["Biển số xe", "47C-123.45"],
      ["Khách hàng", "Công ty Minh Anh"],
    ]) {
      await page.getByRole("button", { name: label, exact: true }).click();
      await page.getByText(value, { exact: true }).waitFor();
      check(
        "browser grouped " + label,
        await page.getByText("Thành tiền: 60.000 đ", { exact: true }).count(),
        1,
      );
      const searchLabel =
        label === "Khách hàng"
          ? "Tìm khách hàng"
          : label === "Hàng hóa"
            ? "Tìm hàng hóa"
            : "Tìm biển số xe";
      const searchValue =
        label === "Khách hàng" ? "Minh" : label === "Hàng hóa" ? "phê" : "47c";
      const searched = page.waitForResponse(
        (response) =>
          response.url().includes("/reports/groups?") &&
          new URL(response.url()).searchParams.get("search") === searchValue &&
          response.status() === 200,
      );
      await page.getByLabel(searchLabel, { exact: true }).fill(searchValue);
      await searched;
      await page.getByText("Thành tiền: 60.000 đ", { exact: true }).waitFor();
      await page.getByLabel(searchLabel, { exact: true }).fill("absent-search");
      await page.getByText("Chưa có dữ liệu", { exact: true }).waitFor();
      check(
        "browser search empty " + label,
        await page.getByText(value, { exact: true }).count(),
        0,
      );
      await page
        .getByRole("button", { name: "Xóa tìm kiếm thống kê", exact: true })
        .click();
      await page.getByText("Thành tiền: 60.000 đ", { exact: true }).waitFor();
    }
    await page.getByRole("button", { name: "Tùy chọn", exact: true }).click();
    await page.setViewportSize({ width: 320, height: 380 });
    await page.getByLabel("Từ ngày", { exact: true }).fill("31/02/2026");
    await page
      .getByRole("button", { name: "Áp dụng khoảng thời gian", exact: true })
      .click();
    await page
      .getByText("Vui lòng nhập ngày hợp lệ theo dạng dd/mm/yyyy.", {
        exact: true,
      })
      .waitFor();
    check(
      "invalid custom date keeps editor open",
      await page.getByLabel("Từ ngày", { exact: true }).count(),
      1,
    );
    await page.getByLabel("Từ ngày", { exact: true }).fill("02/01/2020");
    await page.getByLabel("Đến ngày", { exact: true }).fill("01/01/2020");
    await page
      .getByRole("button", { name: "Áp dụng khoảng thời gian", exact: true })
      .click();
    await page
      .getByText("Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.", {
        exact: true,
      })
      .waitFor();
    await page.getByLabel("Từ ngày", { exact: true }).fill("01/01/2020");
    await page.screenshot({
      path: path.join(dir, "overview-date-editor-320.png"),
    });
    await page
      .getByRole("button", { name: "Áp dụng khoảng thời gian", exact: true })
      .click();
    await page
      .getByText("Chưa có dữ liệu trong khoảng đã chọn.", { exact: true })
      .waitFor();
    await page.getByText("Chưa có dữ liệu", { exact: true }).waitFor();
    check(
      "custom range applies to overview and group statistics",
      await page.getByText("01/01/2020 – 01/01/2020", { exact: true }).count(),
      1,
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Tùy chọn", exact: true }).click();
    await page
      .getByRole("button", { name: "Chọn ngày bắt đầu", exact: true })
      .click();
    await page.getByRole("button", { name: "Tháng sau", exact: true }).click();
    await page.getByRole("button", { name: "2020-02-01", exact: true }).click();
    check(
      "overview calendar fills editable date",
      await page.getByLabel("Từ ngày", { exact: true }).inputValue(),
      "01/02/2020",
    );
    await page.getByRole("button", { name: "Đóng", exact: true }).click();
    await page.getByRole("button", { name: "Hôm nay", exact: true }).click();
    await page.getByText("Thành tiền: 60.000 đ", { exact: true }).waitFor();
    await page
      .getByText("Thành tiền: 60.000 đ", { exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: path.join(dir, "grouped-statistics-mobile.png"),
    });
    await page
      .getByRole("button", { name: "Ẩn thống kê", exact: true })
      .click();
    check(
      "grouped statistics hide control",
      await page.getByText("Thành tiền: 60.000 đ", { exact: true }).count(),
      0,
    );
    const oldBackendHtml = (route) =>
      route.fulfill({
        status: 404,
        contentType: "text/html",
        body: "<!DOCTYPE html><html>Cannot GET /reports/groups</html>",
      });
    await page.route("**/reports/groups?**", oldBackendHtml);
    await page.getByRole("button", { name: "7 ngày", exact: true }).click();
    await page
      .getByRole("button", { name: "Xem thống kê", exact: true })
      .click();
    await page
      .getByText(
        "Máy chủ chưa hỗ trợ chức năng này. Vui lòng cập nhật hoặc khởi động lại backend.",
        { exact: true },
      )
      .waitFor();
    check(
      "HTML API failure does not leak JSON parse error",
      await page.getByText(/Unexpected token/).count(),
      0,
    );
    await page.unroute("**/reports/groups?**", oldBackendHtml);
    await page.getByRole("button", { name: "Thử lại", exact: true }).click();
    await page.getByText("Thành tiền: 60.000 đ", { exact: true }).waitFor();
    check(
      "statistics recover after backend update",
      await page.getByText("Thành tiền: 60.000 đ", { exact: true }).count(),
      1,
    );
    await page
      .getByRole("button", { name: "Ẩn thống kê", exact: true })
      .click();
    await page.getByRole("button", { name: "Hôm nay", exact: true }).click();
    await verifyTabLabels("station");
    await page.screenshot({ path: path.join(dir, "station-overview.png") });
    check(
      "no provider tab for station",
      await page.getByRole("tab", { name: /Trạm cân/ }).count(),
      0,
    );
    await page.getByRole("tab", { name: /Dữ liệu cân/ }).click();
    await page
      .getByRole("button", { name: "Xem phiếu PC502", exact: true })
      .waitFor();
    await page.screenshot({ path: path.join(dir, "weighings-mobile.png") });
    await page.getByRole("button", { name: "Bộ lọc", exact: true }).click();
    await page
      .getByRole("button", { name: "Chọn từ ngày", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Tháng trước", exact: true })
      .click();
    await page.getByRole("button", { name: "Tháng sau", exact: true }).click();
    await page.getByRole("button", { name: "Đóng", exact: true }).click();
    await page
      .getByRole("button", { name: "Xem phiếu PC502", exact: true })
      .click();
    await page.getByText("Thành tiền", { exact: true }).waitFor();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(dir, "detail-mobile.png") });
    await page.getByRole("button", { name: "Đóng", exact: true }).click();
    await page.getByRole("tab", { name: /Tài khoản/ }).click();
    await page.getByText("Thông tin trạm", { exact: true }).waitFor();
    check(
      "profile explanatory notes removed",
      await page.getByText("Phạm vi dữ liệu", { exact: true }).count(),
      0,
    );
    check(
      "account privacy links to published policy",
      await page
        .getByRole("link", { name: "Chính sách quyền riêng tư", exact: true })
        .getAttribute("href"),
      "https://www.doluongquochung.com/privacy-policies/qhs-scales",
    );
    await page
      .getByRole("button", { name: "Đăng xuất", exact: true })
      .waitFor();
    await page.screenshot({ path: path.join(dir, "station-profile.png") });
    await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
    await page.getByLabel("Tài khoản", { exact: true }).fill("localadmin");
    await page.getByLabel("Mật khẩu", { exact: true }).fill("Station-test-123");
    await page.getByLabel("Mật khẩu", { exact: true }).press("Enter");
    await page.getByText("Quản trị hệ thống", { exact: true }).waitFor();
    await page.getByText("150.000", { exact: false }).first().waitFor();
    await verifyTabLabels("admin");
    await page.screenshot({ path: path.join(dir, "admin-overview.png") });
    await page.getByRole("tab", { name: /Trạm cân/ }).click();
    await page
      .getByRole("button", { name: "Thêm trạm", exact: true })
      .click();
    await page.getByLabel("Tên trạm cân", { exact: true }).fill("Trạm mới");
    await page
      .getByRole("button", { name: "Tạo trạm cân", exact: true })
      .click();
    await page.getByText("Trạm mới", { exact: true }).waitFor();
    await page.getByRole("tab", { name: /Tài khoản/ }).click();
    await page.setViewportSize({ width: 320, height: 568 });
    await page
      .getByRole("button", { name: "Thêm tài khoản", exact: true })
      .click();
    await page.getByRole("button", { name: "Chọn trạm cân", exact: true }).click();
    await page.getByRole("button", { name: / · #1$/ }).click();
    await page
      .getByLabel("Tên đăng nhập", { exact: true })
      .fill("browser");
    await page.getByLabel("Mật khẩu", { exact: true }).fill("Browser-test-123");
    await page.setViewportSize({ width: 320, height: 380 });
    await page.getByRole("button", { name: "Trạm cân", exact: true }).click();
    await page
      .getByRole("button", { name: "Tạo tài khoản", exact: true })
      .click();
    await page.getByText("browser", { exact: true }).waitFor();
    check("browser runtime errors", errors, []);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({
      path: path.join(dir, "admin-accounts-desktop.png"),
    });
    await page.getByRole("tab", { name: /Hồ sơ$/ }).click();
    await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
    await page.getByLabel("Tài khoản", { exact: true }).waitFor();
  }
  fs.mkdirSync(path.join(root, "artifacts/v3"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "artifacts/v3/verification.json"),
    JSON.stringify(
      { database, checks: checks.length, passed: checks },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      result: "PASS",
      checks: checks.length,
      database,
      browser: !!process.env.PLAYWRIGHT_PATH,
    }),
  );
})()
  .catch((e) => {
    console.error(e.stack);
    console.error(logs.join("").slice(-4000));
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close();
    if (server) server.kill();
    if (connection) await connection.end();
  });
