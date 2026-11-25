// Disposable MariaDB on 127.0.0.1:3317. No private dump or backend/.env is used.
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { spawn, execFileSync } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");

const root = path.resolve(__dirname, "..");
const dbName = "qhs_mobile_durian_test_" + Date.now();
const secondDbName = process.argv.includes("--dual-db") ? dbName + "_second" : "";
const password = "Fixture-only-123";
const hash = createHash("md5")
  .update(password + "@haiviet")
  .digest("hex")
  .toUpperCase();
const day = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
const time = (clock) => day + "T" + clock;
const output = path.join(root, "artifacts", "ui-polish");
const base = "http://127.0.0.1:4027";

async function request(url, { token, method = "GET", body } = {}) {
  const response = await fetch(base + url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(6000),
  });
  return { status: response.status, data: await response.json() };
}

async function login(username, status = 200, source) {
  const result = await request("/auth/login", {
    method: "POST",
    body: { username, password, source },
  });
  assert.equal(
    result.status,
    status,
    username + ": " + JSON.stringify(result.data.message),
  );
  return result.data;
}

async function seed(db) {
  await db.query(`
    CREATE TABLE tbusers_group (id INT AUTO_INCREMENT PRIMARY KEY,name VARCHAR(200),address VARCHAR(200),phonenumber VARCHAR(50),enable TINYINT,startdate DATE,enddate DATE,
      lastid INT,sign_1 VARCHAR(20),sign_2 VARCHAR(20),sign_3 VARCHAR(20),sign_4 VARCHAR(20),idweight_apptype INT,idapp_types INT);
    CREATE TABLE tbusers_role (idtbusers_role INT PRIMARY KEY,name VARCHAR(100),enable TINYINT);
    CREATE TABLE tbusers (id INT AUTO_INCREMENT PRIMARY KEY,username VARCHAR(100),password VARCHAR(64),idusergroup INT,iduserrole INT,enable TINYINT);
    CREATE TABLE tbweight (id INT PRIMARY KEY,formcode VARCHAR(20),truct_no VARCHAR(20),customer_name VARCHAR(100),
      items_name VARCHAR(100), date_in DATETIME,date_out DATETIME,weight_1 DECIMAL(16,3),weight_2 DECIMAL(16,3),
      net_weight DECIMAL(16,3),notes VARCHAR(100),createby INT,idusergroup INT,enable TINYINT,
      customer_id INT,price_total DECIMAL(16,2));
    CREATE TABLE qhs_durian_user_access (GroupId INT,UserId INT,Role ENUM('operator','admin'),PRIMARY KEY(GroupId,UserId));
    CREATE TABLE qhs_durian_records (GroupId INT NOT NULL,Kind VARCHAR(16) NOT NULL,RecordId VARCHAR(64) NOT NULL,
      GateId VARCHAR(64),State VARCHAR(20),ActiveSlot VARCHAR(64),Payload LONGTEXT NOT NULL,Revision INT DEFAULT 1,
      PRIMARY KEY(GroupId,Kind,RecordId),UNIQUE KEY(GroupId,ActiveSlot));
    INSERT INTO tbusers_group (id,name,enable) VALUES
      (1,'Trạm cân xe tải An Phú',1),(2,'Trạm cân sầu riêng An Phú',1),(3,'Trạm sầu riêng Bình Minh',1),
      (4,'Trạm đã khóa',0),(5,'Trạm chờ cấu hình',1);
    INSERT INTO tbusers_role VALUES (1,'Nhân viên',1);
    INSERT INTO qhs_durian_user_access VALUES (2,21,'operator'),(3,31,'admin'),(4,41,'operator'),(5,51,'operator');
    INSERT INTO tbweight (id,formcode,truct_no,weight_1,weight_2,net_weight,createby,idusergroup,enable,date_in)
      VALUES (101,'XE-101','47C-101.00',25000,6600,18400,11,1,1,NOW()),(102,'XE-102','47C-102.00',200,100,100,21,2,1,NOW());
  `);
  for (const [id, username, station] of [
    [11, "truck", 1],
    [21, "durian", 2],
    [22, "unassigned", 2],
    [31, "durian-other", 3],
    [41, "disabled", 4],
    [51, "unknown", 5],
    [12, "company", 1],
  ])
    await db.execute("INSERT INTO tbusers VALUES (?,?,?,?,1,1)", [
      id,
      username,
      hash,
      station,
    ]);
  for (const migration of ["auth-migration.sql", "mobile-v2.sql", "mobile-station-config.sql"])
    await db.query(
      await fs.readFile(
        path.join(root, "backend", "database", migration),
        "utf8",
      ),
    );
  await db.execute(
    "INSERT INTO app_users (id,email,password_hash,full_name,role,status) VALUES (1,'legacy-admin',?,'QHS','admin',1)",
    [await bcrypt.hash(password, 4)],
  );
  for (let order = 1; order <= 9; order++) {
    await put(db, 2, "gate", "gate-" + order, null, null, {
      Id: "gate-" + order,
      Name: "Cửa " + order,
      Order: order,
      Enabled: true,
    });
  }
  await put(db, 2, "gate", "gate-hidden", null, null, {
    Name: "Cửa đã ẩn",
    Order: 10,
    Enabled: false,
  });
  await ticket(db, "completed", "0001", "gate-1", "Completed", {
    Plate: "47C-128.68",
  });
  await ticket(db, "completed-two", "0002", "gate-3", "Completed", {
    Plate: "49H-105.27",
    Supplier: "Vườn Minh An",
    Prices: { d: 32000 },
  });
  await ticket(db, "running", "0003", "gate-2", "Running", {
    Plate: "47H-021.39",
  });
  await ticket(db, "simulation", "0004", "gate-4", "Running", { IsTest: true });
  await ticket(db, "completed-test", "0005", "gate-4", "Completed", {
    IsTest: true,
  });
  await ticket(
    db,
    "other-only",
    "0001",
    null,
    "Completed",
    { Plate: "52A-111.11" },
    3,
  );
  for (let i = 0; i < 21; i++) {
    await ticket(
      db,
      "history-" + i,
      String(i + 10).padStart(4, "0"),
      "gate-1",
      "Completed",
      {
        Arrival: "2020-01-02T06:00:00",
        StoppedAt: "2020-01-02T10:00:00",
      },
    );
  }
  await event(db, "a1", "completed", "a", 250.25);
  await event(db, "a2", "completed", "a", 125.25, {
    ReceivedAt: time("09:10:00"),
  });
  await event(db, "b1", "completed", "b", 180.75);
  await event(db, "e1", "completed", "e", 55);
  await event(db, "d1", "completed-two", "d", 302.75);
  await event(
    db,
    "pending",
    "completed",
    "a",
    999,
    { Problem: "Kiểm tra lượt cân" },
    "Pending",
  );
  await event(db, "voided", "completed", "a", 999, { Voided: true }, "Voided");
  await event(db, "flagged", "completed", "a", 999, {
    Problem: "Kiểm tra lượt cân",
  });
  await event(db, "test", "completed", "a", 999, { IsTest: true });
  await event(db, "r1", "running", "a", 94.4);
  await event(db, "r2", "running", "b", 34);
}

function put(db, station, kind, id, gate, state, data) {
  return db.execute(
    "INSERT INTO qhs_durian_records (GroupId,Kind,RecordId,GateId,State,Payload) VALUES (?,?,?,?,?,?)",
    [station, kind, id, gate, state, JSON.stringify(data)],
  );
}

function ticket(db, id, number, gate, state, extra = {}, station = 2) {
  return put(db, station, "ticket", id, gate, state, {
    Id: id,
    Number: number,
    IsTest: false,
    GateId: gate,
    GateName: gate?.replace("gate-", "Cửa "),
    Status: state,
    Arrival: time("07:30:00"),
    StartedAt: time("07:45:00"),
    StoppedAt: state === "Completed" ? time("10:20:00") : null,
    Supplier: "Hợp tác xã Đắk Lắk",
    Prices: { a: 65001, b: 52000 },
    ItemNames: { a: "Hàng A", b: "Hàng B", e: "Dạt" },
    ItemDescriptions: { a: "SR Thái", b: "SR Ri 6", e: "Musangking" },
    TaxAmount: 1000,
    ...extra,
  });
}

function event(db, id, ticketId, code, weight, extra = {}, state = "Accepted") {
  return put(db, 2, "event", id, null, state, {
    Id: id,
    TicketId: ticketId,
    IsTest: false,
    Voided: false,
    ReceivedAt: time("08:15:00"),
    ItemType: code,
    Weight: weight,
    ...extra,
  });
}

async function verifyDatabaseSources() {
  const as = (session, url, options) => request(url, { token: session.accessToken, ...options });
  const admin = await login("company", 200, "db1");
  const copiedAdmin = await login("company", 200, "db2");
  assert.equal(copiedAdmin.user.role, "station");
  assert.equal((await as(copiedAdmin, "/admin/stations?source=db2")).status, 403);
  assert.deepEqual((await login("truck", 409)).databaseSources, ["db1", "db2"]);
  const original = await login("truck", 200, "db1");
  const second = await login("truck", 200, "db2");
  assert.equal(second.user.source, "db2");
  assert.equal((await as(original, "/weighings/101?source=db2")).data.item.formcode, "XE-101");
  assert.equal((await as(second, "/weighings/101?source=db1")).data.item.formcode, "DB2-101");
  assert.equal((await as(second, "/weighings/102?stationId=2")).status, 404);
  const refreshed = await request("/auth/refresh", {
    method: "POST", body: { refreshToken: second.refreshToken },
  });
  assert.equal(refreshed.data.user.source, "db2");
  assert.equal((await as(admin, "/weighings/101?source=db2")).data.item.formcode, "DB2-101");

  async function configure(source, id, data, status = 200) {
    const url = "/admin/stations/" + id + "?source=" + source;
    const current = await as(admin, url);
    assert.equal(current.status, 200);
    const station = current.data;
    const result = await as(admin, url, {
      method: "PATCH",
      body: {
        name: station.name, address: station.address ?? "",
        phonenumber: station.phonenumber ?? "", enabled: station.enabled,
        version: station.version, data,
      },
    });
    assert.equal(result.status, status, JSON.stringify(result.data));
  }

  await configure("db2", 1, { stationType: "truck", dataSource: "db1", dataStationId: 999 }, 409);
  await configure("db2", 1, { stationType: "truck", dataSource: "db1", dataStationId: 1 });
  assert.equal((await as(second, "/auth/me")).status, 401);
  assert.equal((await as(original, "/auth/me")).status, 200);
  const mapped = await login("truck", 200, "db2");
  assert.equal(mapped.user.dataSource, "db1");
  assert.equal((await as(mapped, "/weighings")).data.items[0].formcode, "XE-101");
  assert.equal((await as(admin, "/weighings/101?source=db2&stationId=1")).data.item.formcode, "XE-101");
  assert.equal((await as(admin, "/reports?source=db2&stationId=1")).data.summary.totalRecords, 1);
  assert.equal((await as(admin, "/reports/groups?groupBy=vehicle&source=db2&stationId=1")).data.items[0].label, "47C-101.00");

  const previousDurian = await login("durian", 200, "db1");
  await configure("db1", 2, { stationType: "durian", dataSource: "db2", dataStationId: 2 });
  assert.equal((await as(previousDurian, "/auth/me")).status, 401);
  const mappedDurian = await login("durian", 200, "db1");
  const ticket = await as(mappedDurian, "/durian/tickets/completed");
  assert.equal(ticket.status, 200);
  assert.equal(ticket.data.ticket.plate, "DB2-DURIAN");
  const noGrant = await login("unassigned", 200, "db1");
  assert.equal((await as(noGrant, "/durian/tickets/completed")).status, 403);
  await configure("db1", 2, { stationType: "truck", dataSource: "db1" });
  const switched = await login("durian", 200, "db1");
  assert.equal(switched.user.stationType, "truck");
  assert.equal((await as(switched, "/weighings/102")).status, 200);
  assert.equal((await as(switched, "/durian/tickets/completed")).status, 403);
  console.log("PASS: dual database login, isolation, station mapping, reports, and session revocation");
}

async function verifyApi(db) {
  const truck = await login("truck");
  const durian = await login("durian");
  const other = await login("durian-other");
  const unassigned = await login("unassigned");
  const company = await login("company");
  const legacy = await login("legacy-admin");
  assert.equal((await login("unknown")).user.stationType, "unknown");
  await login("disabled", 401);
  assert.equal(truck.user.stationType, "truck");
  assert.deepEqual(durian.user.permissions, ["durian:read"]);
  assert.equal(durian.user.stationType, "durian");
  const as = (session, url) => request(url, { token: session.accessToken });
  assert.equal((await as(truck, "/weighings")).data.total, 1);
  assert.equal((await as(truck, "/reports")).data.summary.totalRecords, 1);
  assert.equal(
    (await as(truck, "/reports/groups?groupBy=vehicle")).data.total,
    1,
  );
  assert.equal((await as(truck, "/admin/roles")).status, 403);
  for (const admin of [company, legacy]) {
    assert.equal(admin.user.stationType, "truck");
    assert.equal((await as(admin, "/weighings")).data.total, 2);
    assert.equal((await as(admin, "/admin/roles")).status, 200);
  }
  assert.equal((await as(truck, "/weighings/102")).status, 404);
  assert.equal((await as(truck, "/durian/tickets/completed")).status, 403);
  assert.equal((await as(durian, "/weighings")).status, 403);
  assert.equal((await as(unassigned, "/durian/overview")).status, 403);
  assert.equal((await as(other, "/durian/tickets/completed")).status, 404);
  assert.equal(
    (await as(durian, "/durian/tickets/other-only?stationId=3")).status,
    404,
  );
  assert.equal(
    (await as(durian, "/durian/tickets/completed-test")).status,
    404,
  );
  const overview = (await as(durian, "/durian/overview")).data;
  assert.deepEqual(overview.purchases, { amount: 43494876, missingPrices: 1 });
  assert.deepEqual(
    [overview.kg, overview.trips, overview.activeGates, overview.gates.length],
    [914, 2, 1, 9],
  );
  assert.equal(overview.gates[0].ticket.id, "running");
  const pageOne = (await as(durian, "/durian/tickets")).data;
  const pageTwo = (await as(durian, "/durian/tickets?page=2")).data;
  assert.deepEqual(
    [pageOne.total, pageOne.items.length, pageTwo.items.length],
    [23, 20, 3],
  );
  assert.equal(
    (await as(durian, "/durian/tickets?q=0001")).data.items[0].number,
    "0001",
  );
  assert.equal(
    (await as(durian, "/durian/tickets?gateId=gate-3")).data.total,
    1,
  );
  const detail = (await as(durian, "/durian/tickets/completed")).data;
  assert.equal(detail.ticket.kg, 611.25);
  assert.equal(detail.events[0].id, "a2");
  assert.equal(detail.events.length, 4);
  assert.deepEqual(
    detail.items.map(({ code, amount }) => [code, amount]),
    [
      ["a", 24407876],
      ["b", 9399000],
      ["e", null],
    ],
  );
  assert.equal(detail.total, 33807876);
  const reportQuery = "?startDate=" + day + "&endDate=" + day;
  for (const groupBy of ["ticket", "gate", "grade", "supplier"]) {
    const report = (
      await as(durian, "/durian/reports" + reportQuery + "&groupBy=" + groupBy)
    ).data;
    assert.deepEqual(
      [report.kg, report.trips, report.amount],
      [914, 2, 43494876],
    );
    for (const group of report.groups) {
      const linked = (
        await as(
          durian,
          "/durian/tickets" +
            reportQuery +
            "&groupBy=" +
            groupBy +
            "&groupKey=" +
            encodeURIComponent(group.key),
        )
      ).data;
      assert.equal(linked.total, group.trips);
    }
  }
  if (process.env.QHS_DESKTOP_EXE) {
    const [records] = await db.query(
      "SELECT Kind AS kind, Payload AS payload FROM qhs_durian_records WHERE GroupId=2 AND Kind IN ('ticket','event')",
    );
    const desktop = JSON.parse(
      execFileSync(
        "powershell.exe",
        [
          "-NoProfile",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          path.join(__dirname, "compare-durian-desktop.ps1"),
          "-DesktopExe",
          process.env.QHS_DESKTOP_EXE,
          "-Day",
          day,
        ],
        {
          input: JSON.stringify(
            records.map(({ kind, payload }) => ({
              kind,
              data: JSON.parse(payload),
            })),
          ),
          encoding: "utf8",
          windowsHide: true,
        },
      ),
    );
    const report = (
      await as(durian, "/durian/reports" + reportQuery + "&groupBy=ticket")
    ).data;
    assert.deepEqual(desktop, {
      kg: report.kg,
      trips: report.trips,
      amount: report.amount,
      ticketTotal: detail.total,
    });
    console.log(
      "Desktop executable and API matched on the same fixture:",
      desktop,
    );
  }
  const manage = (url, method = "GET", body) =>
    request(url, { token: company.accessToken, method, body });
  const newStation = {
    name: "Trạm nghiệm thu",
    address: "Đắk Lắk",
    phonenumber: "",
    enabled: true,
  };
  const createdStation = await manage("/admin/stations", "POST", newStation);
  assert.equal(createdStation.status, 201);
  const stationPath = "/admin/stations/" + createdStation.data.id;
  const stationVersion = async () => (await manage(stationPath)).data.version;
  const original = await stationVersion();
  assert.equal(
    (
      await manage(stationPath, "PATCH", {
        ...newStation,
        address: "Lâm Đồng",
        version: original,
      })
    ).status,
    200,
  );
  assert.equal(
    (await manage(stationPath, "DELETE", { version: original })).status,
    409,
  );
  const draft = {
    username: "newstaff",
    password,
    stationId: createdStation.data.id,
    roleId: 1,
    enabled: true,
  };
  assert.equal(
    (
      await request("/admin/accounts", {
        token: truck.accessToken,
        method: "POST",
        body: draft,
      })
    ).status,
    403,
  );
  const createdAccount = await manage("/admin/accounts", "POST", draft);
  assert.equal(createdAccount.status, 201);
  const accountPath = "/admin/accounts/" + createdAccount.data.id;
  const accountList = (name) => manage("/admin/accounts?q=" + name);
  const accountVersion = async (name) =>
    (await accountList(name)).data.items[0].version;
  assert.equal(
    (await manage(stationPath, "DELETE", { version: await stationVersion() }))
      .status,
    409,
  );
  const initialSession = await login("newstaff");
  assert.equal(
    (
      await manage(accountPath, "PATCH", {
        username: "newdurian",
        stationId: 2,
        roleId: 1,
        enabled: true,
        durianRole: "operator",
        version: await accountVersion("newstaff"),
      })
    ).status,
    200,
  );
  assert.equal((await as(initialSession, "/weighings")).status, 401);
  const assigned = await login("newdurian");
  assert.deepEqual(assigned.user.permissions, ["durian:read"]);
  assert.equal(
    (await manage(stationPath, "DELETE", { version: await stationVersion() }))
      .status,
    200,
  );
  assert.equal((await manage(stationPath)).status, 404);
  await db.execute(
    "INSERT INTO tbweight (id,formcode,createby,idusergroup,enable,date_in) VALUES (103,'XE-103',?,?,1,NOW())",
    [createdAccount.data.id, createdStation.data.id],
  );
  assert.equal(
    (
      await manage(accountPath, "DELETE", {
        version: await accountVersion("newdurian"),
      })
    ).status,
    200,
  );
  assert.equal((await accountList("newdurian")).data.total, 0);
  assert.equal((await as(assigned, "/durian/overview")).status, 401);
  assert.equal((await as(company, "/weighings/103")).status, 200);
  await db.query("UPDATE tbusers_group SET enable=0 WHERE id=3");
  assert.equal((await as(other, "/durian/overview")).status, 401);
  await db.query("UPDATE tbusers_group SET enable=1 WHERE id=3");
  await db.query(
    "DELETE FROM qhs_durian_user_access WHERE GroupId=3 AND UserId=31",
  );
  assert.equal((await as(other, "/durian/overview")).status, 401);
  assert.deepEqual((await login("durian-other")).user.permissions, []);
  await request("/auth/logout", {
    method: "POST",
    body: { refreshToken: durian.refreshToken },
  });
  assert.equal((await as(durian, "/durian/overview")).status, 401);
  console.log(
    "API passed: truck, station type and permissions, direct links, locks, real/valid events, pagination, reports, and logout.",
  );
}

async function verifyDatabaseSourceBrowser() {
  const { chromium } = require(process.env.PLAYWRIGHT_PATH);
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH,
    headless: true,
  });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const button = (name) => page.getByRole("button", { name, exact: true });
    const text = (value) => page.getByText(value, { exact: true });
    async function signIn(username, source) {
      await page.goto("http://localhost:8088/login", { timeout: 120_000 });
      await page.locator("input").nth(0).fill(username);
      await page.locator("input").nth(1).fill(password);
      await text("Đăng nhập").last().click();
      await text("Nguồn đăng nhập").waitFor({ timeout: 30_000 });
      await button(source).click();
      await text("Đăng nhập").last().click();
    }
    await signIn("company", "Database 1");
    await page.waitForURL("**/dashboard");
    await text("Trạm cân").last().click();
    await text("Quản lý trạm cân").waitFor();
    await button("Database 2").click();
    await button("Thao tác với Trạm sầu riêng Bình Minh").click();
    await button("Chỉnh sửa").click();
    await button("Cân xe tải").click();
    await button("Database 1").last().click();
    await page.getByLabel("Mã trạm ở nguồn dữ liệu").fill("1");
    await text("Trạm cân xe tải An Phú").last().waitFor();
    const saved = page.waitForResponse((response) =>
      response.request().method() === "PATCH" &&
      new URL(response.url()).pathname === "/admin/stations/3" &&
      new URL(response.url()).searchParams.get("source") === "db2");
    await button("Lưu thay đổi").click();
    assert.equal((await saved).status(), 200);
    await text("Database 1 · #1").waitFor();

    const stationPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await stationPage.goto("http://localhost:8088/login");
    await stationPage.locator("input").nth(0).fill("truck");
    await stationPage.locator("input").nth(1).fill(password);
    await stationPage.getByText("Đăng nhập", { exact: true }).last().click();
    await stationPage.getByRole("button", { name: "Database 2", exact: true }).click();
    await stationPage.getByText("Đăng nhập", { exact: true }).last().click();
    await stationPage.waitForURL("**/dashboard");
    await stationPage.getByText("Dữ liệu cân", { exact: true }).last().click();
    await stationPage.getByText(/DB2-101/).first().waitFor();
    assert.deepEqual(errors, []);
    console.log("PASS: Chrome switched admin database, saved cross-database routing, and loaded a Database 2 ticket");
  } finally {
    await browser.close();
  }
}

async function verifyBrowser(db) {
  const { chromium } = require(process.env.PLAYWRIGHT_PATH);
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH,
    headless: true,
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    const touch = await context.newCDPSession(page);
    async function swipe(x, y, dx, dy) {
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y }],
      });
      for (let step = 1; step <= 5; step++) {
        await touch.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: x + (dx * step) / 5, y: y + (dy * step) / 5 }],
        });
      }
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
    }
    const errors = [];
    const historyPages = new Set();
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => {
      const url = new URL(response.url());
      if (url.pathname === "/durian/tickets" && response.ok())
        historyPages.add(url.searchParams.get("page"));
    });
    const exact = (text) =>
      page.getByText(text, { exact: true }).filter({ visible: true });
    const visible = (text) =>
      exact(text).first().waitFor({ state: "visible", timeout: 30_000 });
    const button = (name) => page.getByRole("button", { name, exact: true });
    const screenshot = (name) =>
      page.screenshot({
        path: path.join(output, name + ".png"),
        animations: "disabled",
      });
    async function signIn(username) {
      await page.locator("input").nth(0).fill(username);
      await page.locator("input").nth(1).fill(password);
      await exact("Đăng nhập").last().click();
    }
    await fs.mkdir(output, { recursive: true });
    await page.goto("http://localhost:8088/login", { timeout: 120_000 });
    await signIn("durian");
    await visible("Cửa 2");
    assert.match(page.url(), /\/durian\/?$/);
    assert.equal(await exact("Trạm cân sầu riêng An Phú").count(), 0);
    await visible("43.494.876 ₫");
    await visible("1 phiếu chưa đủ đơn giá");
    await screenshot("03-can-sau-rieng");
    await page.setViewportSize({ width: 320, height: 700 });
    await button("Đang cân").click();
    assert.equal(await exact("Cửa 9").count(), 0);
    await button("Tất cả").click();
    await exact("Cửa 9").scrollIntoViewIfNeeded();
    const narrowWidth = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      window.innerWidth,
    ]);
    assert.ok(
      narrowWidth[0] <= narrowWidth[1],
      "320px view has no horizontal overflow",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await exact("Cửa 2").click();
    await visible("Chi tiết phiếu");
    await visible("128,4 kg");
    const weight = await exact("128,4 kg").first().boundingBox();
    await swipe(294, weight.y + weight.height / 2, -168, 0);
    await visible("94,4 kg");
    await context.setOffline(true);
    await button("Làm mới dữ liệu").click();
    await visible("Đang xem dữ liệu đã tải.");
    await visible("128,4 kg");
    await event(db, "synced", "running", "a", 10);
    await context.setOffline(false);
    await button("Làm mới dữ liệu").click();
    await visible("138,4 kg");
    await button("Quay lại").click();
    await exact("Phiếu cân").last().click();
    await visible("47C-128.68");
    const ticketList = page.getByTestId("durian-ticket-list");
    for (let i = 0; i < 5 && !historyPages.has("2"); i++) {
      await swipe(180, 715, 0, -545);
    }
    if (!historyPages.has("2")) {
      await Promise.all([
        page.waitForResponse(
          (response) =>
            response.ok() &&
            /\/durian\/tickets\?.*&page=2$/.test(response.url()),
          { timeout: 5000 },
        ),
        ticketList.evaluate((list) => list.scrollTo(0, list.scrollHeight)),
      ]);
    }
    assert.ok(historyPages.has("2"), "scrolling touches load the next page");
    await ticketList.evaluate((list) => list.scrollTo(0, 0));
    await page.setViewportSize({ width: 320, height: 580 });
    await button("Bộ lọc").click();
    await button("Cửa 1").click();
    await button("Áp dụng").click();
    await page.setViewportSize({ width: 390, height: 844 });
    await visible("47C-128.68");
    await exact("49H-105.27").first().waitFor({ state: "hidden" });
    await exact("47C-128.68").click();
    await button("Đơn mua hàng").click();
    await visible("Chưa có đơn giá");
    await button("Lượt cân").click();
    await visible("125,25 kg");
    await button("Quay lại").click();
    await exact("Báo cáo").last().click();
    await visible("914 kg");
    await button("Kỳ báo cáo").click();
    await button("Tháng").click();
    await page.getByLabel("Tháng (YYYY-MM)", { exact: true }).fill("2020-01");
    await button("Áp dụng").click();
    await visible("21 chuyến đã kết thúc");
    await exact("Tổng quan").last().click();
    await button("Xem báo cáo mua hàng hôm nay").click();
    await visible("914 kg");
    await screenshot("04-bao-cao-sau-rieng");
    await button("Kỳ báo cáo").click();
    await button("Khoảng ngày").click();
    const dateInput = page.getByLabel("Ngày (YYYY-MM-DD)", { exact: true });
    await dateInput.scrollIntoViewIfNeeded();
    const field = await dateInput.boundingBox();
    await swipe(field.x + 12, field.y + 8, 0, 78);
    await dateInput.waitFor({ state: "hidden", timeout: 6000 });
    await button("Nhóm báo cáo").click();
    await button("Phân loại").click();
    await visible("Hàng A");
    await exact("Hàng A").click();
    await visible("47C-128.68");
    assert.equal(await exact("49H-105.27").count(), 0);
    await exact("Tài khoản").last().click();
    await visible("Tên đăng nhập");
    await visible("durian");
    assert.equal(
      await page
        .getByText(/Mã trạm/)
        .filter({ visible: true })
        .count(),
      0,
    );
    await page
      .getByRole("link", { name: /Hỗ trợ phần mềm/ })
      .waitFor({ state: "visible" });
    await screenshot("05-tai-khoan-sau-rieng");
    await button("Đăng xuất").click();
    await signIn("truck");
    await visible("Cân xe tải");
    await visible("Dữ liệu cân");
    await visible("Phiếu gần đây");
    await screenshot("02-can-xe-tai");
    await page
      .getByRole("button", { name: / · 0 kg$/ })
      .first()
      .click();
    await visible("0 tấn");
    await exact("47C-101.00").click();
    await visible("Chi tiết phiếu cân");
    await button("Thông tin").click();
    await visible("Giờ vào");
    const sheetTitle = await exact("Chi tiết phiếu cân").first().boundingBox();
    await swipe(sheetTitle.x + 65, sheetTitle.y + 6, 0, 105);
    await exact("Chi tiết phiếu cân").first().waitFor({ state: "hidden" });
    assert.equal(await exact("47C-128.68").count(), 0);
    await page.goto("http://localhost:8088/durian/ticket/completed");
    await visible("Dữ liệu cân");
    assert.equal(await exact("47C-128.68").count(), 0);
    await exact("Tài khoản").last().click();
    await page
      .getByRole("link", { name: /Hỗ trợ phần mềm/ })
      .waitFor({ state: "visible" });
    await screenshot("06-ho-tro-xe-tai");
    await button("Đăng xuất").click();
    await signIn("company");
    await visible("Quản trị hệ thống");
    await button("Quản lý tài khoản").click();
    await visible("Quản lý tài khoản");
    await expectAdminAccountWorkflow(page, button, visible);
    await screenshot("01-quan-tri");
    assert.deepEqual(errors, []);
    console.log(
      "Browser passed: 320px, nine gates, swipe tabs, swipe-to-dismiss, scroll pagination, filters, chart, offline cache, and account switching.",
    );
  } finally {
    await browser.close();
  }
}

async function expectAdminAccountWorkflow(page, button, visible) {
  await page.getByLabel("Tìm tài khoản", { exact: true }).fill("durian");
  await button("Thao tác với durian").click();
  await button("Gán trạm và quyền").click();
  await visible("Vai trò trên phần mềm cân");
  await visible("Quyền cân sầu riêng");
  await button("Đóng").click();
  await page.getByLabel("Tìm tài khoản", { exact: true }).fill("");
  await button("Thêm tài khoản").waitFor({ state: "visible" });
  await button("Thao tác với company").waitFor({ state: "visible" });
  await page.getByLabel("Tìm tài khoản", { exact: true }).blur();
}

(async () => {
  const db = await mysql.createConnection({
    host: "127.0.0.1",
    port: 3317,
    user: "root",
    password: process.env.QHS_TEST_DB_PASSWORD || "test-root-only",
    multipleStatements: true,
  });
  let server;
  let stderr = "";
  try {
    await db.query(
      "CREATE DATABASE " +
        dbName +
        " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
    );
    await db.changeUser({ database: dbName });
    await seed(db);
    if (secondDbName) {
      await db.query("CREATE DATABASE " + secondDbName + " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
      await db.changeUser({ database: secondDbName });
      await seed(db);
      await db.query("UPDATE tbweight SET formcode='DB2-101' WHERE id=101");
      await db.query("UPDATE qhs_durian_records SET Payload=JSON_SET(Payload,'$.Plate','DB2-DURIAN') WHERE GroupId=2 AND Kind='ticket' AND RecordId='completed'");
      await db.changeUser({ database: dbName });
    }
    server = spawn(
      process.execPath,
      ["--import", "tsx", "backend/src/server.ts"],
      {
        cwd: root,
        windowsHide: true,
        stdio: ["ignore", "ignore", "pipe"],
        env: {
          ...process.env,
          PORT: "4027",
          DB_HOST: "127.0.0.1",
          DB_PORT: "3317",
          DB_NAME: dbName,
          DB2_NAME: secondDbName,
          DB_USER: "root",
          DB_PASSWORD: process.env.QHS_TEST_DB_PASSWORD || "test-root-only",
          NODE_ENV: "test",
          JWT_ACCESS_SECRET: "isolated-durian-fixture-only-1234567890123456",
          QHS_DURIAN_STATION_IDS: "2,3,4",
          QHS_DURIAN_STATION_IDS_DB2: "2,3,4",
          QHS_COMPANY_STATION_ID: "1",
          QHS_COMPANY_ADMIN_USER_IDS: "12",
          CLIENT_URL: "http://localhost:8088",
        },
      },
    );
    server.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    for (let i = 0; i < 40; i++) {
      if ((await request("/health").catch(() => null))?.status === 200) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert.equal((await request("/health")).status, 200);
    if (secondDbName) {
      if (process.env.PLAYWRIGHT_PATH) await verifyDatabaseSourceBrowser();
      await verifyDatabaseSources();
    }
    else {
      await verifyApi(db);
      if (process.env.PLAYWRIGHT_PATH) await verifyBrowser(db);
    }
  } catch (error) {
    console.error(stderr || "", error);
    process.exitCode = 1;
  } finally {
    server?.kill();
    if (/^qhs_mobile_durian_test_\d+_second$/.test(secondDbName))
      await db.query("DROP DATABASE IF EXISTS " + secondDbName);
    if (/^qhs_mobile_durian_test_\d+$/.test(dbName))
      await db.query("DROP DATABASE IF EXISTS " + dbName);
    await db.end();
  }
})();
