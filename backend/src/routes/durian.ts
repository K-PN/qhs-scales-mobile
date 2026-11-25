import { Router } from "express";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { z } from "zod";
import { dbFor } from "../config/db.js";
import { requireDataStation } from "../config/station-type.js";
import type { AppUser } from "../types/auth.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { HttpError, route } from "../utils/http.js";
import {
  type DurianDetail,
  type DurianRecord,
  type GateData,
  parseData,
  reportGroups,
  sum,
  summarizeTicket,
} from "../utils/durian.js";

const router = Router();
router.use(requireAuth, requirePermission("durian:read"));

const recordId = z.string().min(1).max(64);
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(value + "T00:00:00Z");
    return (
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    );
  });
const group = z.enum(["ticket", "gate", "grade", "supplier"]);
const filters = z
  .object({
    startDate: day.optional(),
    endDate: day.optional(),
    q: z.string().trim().max(100).default(""),
    gateId: recordId.optional(),
    groupBy: group.optional(),
    groupKey: z.string().max(512).optional(),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .refine(
    (value) =>
      !value.startDate || !value.endDate || value.startDate <= value.endDate,
  )
  .refine(
    (value) => (value.groupBy === undefined) === (value.groupKey === undefined),
  );
type Filters = z.infer<typeof filters>;
const reportFilter = z
  .object({ startDate: day, endDate: day, groupBy: group })
  .refine((value) => value.startDate <= value.endDate);

const source = "qhs_durian_records";
const fields =
  "RecordId AS id, GateId AS gateId, State AS state, Payload AS payload";
const json = (key: string) =>
  `JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(Payload),Payload,'{}'),'$.${key}'))`;
const arrival = json("Arrival");
const ended = `COALESCE(NULLIF(${json("StoppedAt")},'null'),NULLIF(${json("FinalizedAt")},'null'),NULLIF(${json("Departure")},'null'))`;
const placeholders = (count: number) => Array(count).fill("?").join(",");
type SqlParam = string | number;

async function snapshot<T>(user: AppUser, read: (connection: PoolConnection, station: number) => Promise<T>) {
  const source = user.source ?? "db1";
  const dataSource = user.dataSource ?? source;
  const dataStationId = user.dataStationId ?? user.stationId;
  if (!dataStationId) throw new HttpError(403, "Tài khoản chưa được gán trạm.");
  await requireDataStation({ stationType: "durian", dataSource, dataStationId }, source);
  const connection = await dbFor(dataSource).getConnection();
  try {
    await connection.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
    await connection.query(
      "START TRANSACTION READ ONLY, WITH CONSISTENT SNAPSHOT",
    );
    return await read(connection, dataStationId);
  } finally {
    try {
      await connection.rollback();
    } finally {
      connection.release();
    }
  }
}

async function rows(
  connection: PoolConnection,
  sql: string,
  params: SqlParam[],
) {
  const [result] = await connection.execute<(DurianRecord & RowDataPacket)[]>(
    sql,
    params,
  );
  return result;
}

async function getGates(connection: PoolConnection, station: number) {
  const records = await rows(
    connection,
    `SELECT ${fields} FROM ${source} WHERE GroupId=? AND Kind='gate'`,
    [station],
  );
  return records
    .flatMap((record) => {
      const data = parseData<GateData>(record);
      return data
        ? [
            {
              id: record.id,
              name: data.Name || "Cửa cân",
              enabled: data.Enabled === true,
              order: data.Order ?? 0,
            },
          ]
        : [];
    })
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "vi"));
}

function ticketScope(
  station: number,
  f: Partial<Filters>,
  status: "Running" | "Completed",
) {
  const conditions = [
    "GroupId=?",
    "Kind='ticket'",
    "State=?",
    `${json("IsTest")}='false'`,
  ];
  const params: SqlParam[] = [station, status];
  const add = (condition: string, value: SqlParam) => {
    conditions.push(condition);
    params.push(value);
  };
  if (f.startDate) add(`LEFT(${arrival},10)>=?`, f.startDate);
  if (f.endDate) add(`LEFT(${arrival},10)<=?`, f.endDate);
  if (f.gateId) add("GateId=?", f.gateId);
  if (f.q)
    add(
      `LOCATE(LOWER(?),LOWER(CONCAT_WS(' ',${json("Plate")},${json("Number")})))>0`,
      f.q,
    );
  if (f.groupBy === "gate") add("BINARY GateId=?", f.groupKey!);
  if (f.groupBy === "ticket") add("BINARY RecordId=?", f.groupKey!);
  if (f.groupBy === "supplier")
    add(
      `BINARY TRIM(COALESCE(NULLIF(${json("Supplier")},'null'),''))=?`,
      f.groupKey!,
    );
  return { where: conditions.join(" AND "), params };
}

async function withEvents(
  connection: PoolConnection,
  station: number,
  tickets: DurianRecord[],
) {
  const ids = tickets.map(({ id }) => id);
  const byTicket = new Map<string, DurianRecord[]>();
  for (let offset = 0; offset < ids.length; offset += 300) {
    const batch = ids.slice(offset, offset + 300);
    const events = await rows(
      connection,
      `
      SELECT ${fields} FROM ${source}
      WHERE GroupId=? AND Kind='event' AND State='Accepted'
        AND ${json("TicketId")} IN (${placeholders(batch.length)})
      ORDER BY ${json("ReceivedAt")}, RecordId`,
      [station, ...batch],
    );
    for (const event of events) {
      const parentId = (JSON.parse(event.payload) as { TicketId: string })
        .TicketId;
      const related = byTicket.get(parentId);
      if (related) related.push(event);
      else byTicket.set(parentId, [event]);
    }
  }
  return tickets.map((ticket) =>
    summarizeTicket(ticket, byTicket.get(ticket.id) ?? []),
  );
}

function today() {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
}

function ticketCard({
  ticket: { id, number, plate, gateName, endedAt, kg },
}: DurianDetail) {
  return { id, number, plate, gateName, endedAt, kg };
}

router.get(
  "/overview",
  route(async (req, res) => {
    const result = await snapshot(req.user!, async (connection, station) => {
      const day = today();
      const completed = ticketScope(
        station,
        { startDate: day, endDate: day },
        "Completed",
      );
      const running = ticketScope(station, {}, "Running");
      const gates = await getGates(connection, station);
      const done = await rows(
        connection,
        `SELECT ${fields} FROM ${source} WHERE ${completed.where}`,
        completed.params,
      );
      const active = await rows(
        connection,
        `SELECT ${fields} FROM ${source} WHERE ${running.where}`,
        running.params,
      );
      const visibleGates = gates.filter((gate) => gate.enabled);
      const gateIds = new Set(visibleGates.map((gate) => gate.id));
      const details = await withEvents(connection, station, [
        ...done,
        ...active.filter(
          (record) => record.gateId && gateIds.has(record.gateId),
        ),
      ]);
      const completedDetails = details.slice(0, done.length);
      const byGate = new Map(
        details
          .slice(done.length)
          .map((detail) => [detail.ticket.gateId, detail]),
      );
      return {
        kg: sum(completedDetails.map(({ ticket }) => ticket.kg)),
        trips: done.length,
        purchases: {
          amount: sum(completedDetails.map(({ amount }) => amount)),
          missingPrices: completedDetails.filter(
            (detail) => detail.missingPrices,
          ).length,
        },
        activeGates: byGate.size,
        gates: visibleGates
          .map((gate) => {
            const detail = byGate.get(gate.id);
            const ticket = detail?.ticket;
            return {
              id: gate.id,
              name: gate.name,
              ticket: ticket
                ? {
                    id: ticket.id,
                    number: ticket.number,
                    plate: ticket.plate,
                    kg: ticket.kg,
                  }
                : null,
              grades:
                detail?.items.map(({ code, classification, kg }) => ({
                  code,
                  classification,
                  kg,
                })) ?? [],
            };
          })
          .sort(
            (a, b) => Number(Boolean(b.ticket)) - Number(Boolean(a.ticket)),
          ),
      };
    });
    res.json(result);
  }),
);

router.get(
  "/gates",
  route(async (req, res) => {
    const gates = await snapshot(req.user!, getGates);
    res.json(req.query.format === "items" ? { items: gates } : gates);
  }),
);

router.get(
  "/tickets",
  route(async (req, res) => {
    const filter = filters.parse(req.query);
    const offset = (filter.page - 1) * filter.limit;
    const result = await snapshot(req.user!, async (connection, station) => {
      const scope = ticketScope(station, filter, "Completed");
      const ordered = `SELECT ${fields} FROM ${source} WHERE ${scope.where} ORDER BY ${ended} DESC,${arrival} DESC,RecordId DESC`;
      if (filter.groupBy === "grade") {
        const tickets = await rows(connection, ordered, scope.params);
        const matching = (
          await withEvents(connection, station, tickets)
        ).filter(({ items }) =>
          items.some(
            (item) =>
              JSON.stringify([item.code, item.classification]) ===
              filter.groupKey,
          ),
        );
        return {
          total: matching.length,
          items: matching.slice(offset, offset + filter.limit).map(ticketCard),
        };
      }
      const [[count]] = await connection.execute<
        (RowDataPacket & { total: number })[]
      >(
        `SELECT COUNT(*) AS total FROM ${source} WHERE ${scope.where}`,
        scope.params,
      );
      const tickets = await rows(connection, ordered + " LIMIT ? OFFSET ?", [
        ...scope.params,
        filter.limit,
        offset,
      ]);
      return {
        total: Number(count.total),
        items: (await withEvents(connection, station, tickets)).map(ticketCard),
      };
    });
    res.json({ ...result, page: filter.page, limit: filter.limit });
  }),
);

router.get(
  "/tickets/:id",
  route(async (req, res) => {
    const id = recordId.parse(req.params.id);
    const detail = await snapshot(req.user!, async (connection, station) => {
      const tickets = await rows(
        connection,
        `SELECT ${fields} FROM ${source}
      WHERE GroupId=? AND Kind='ticket' AND BINARY RecordId=? AND State IN ('Running','Completed')
        AND ${json("IsTest")}='false'`,
        [station, id],
      );
      if (!tickets.length)
        throw new HttpError(404, "Không tìm thấy phiếu cân.");
      return (await withEvents(connection, station, tickets))[0];
    });
    const {
      ticket: { gateId, arrival, ...ticket },
      ...sections
    } = detail;
    res.json({ ticket, ...sections });
  }),
);

router.get(
  "/reports",
  route(async (req, res) => {
    const filter = reportFilter.parse(req.query);
    const result = await snapshot(req.user!, async (connection, station) => {
      const scope = ticketScope(
        station,
        { startDate: filter.startDate, endDate: filter.endDate },
        "Completed",
      );
      const tickets = await rows(
        connection,
        `SELECT ${fields} FROM ${source} WHERE ${scope.where}
      ORDER BY ${arrival} DESC, ${json("Number")} DESC, RecordId DESC`,
        scope.params,
      );
      const details = await withEvents(connection, station, tickets);
      return {
        kg: sum(details.map(({ ticket }) => ticket.kg)),
        trips: details.length,
        amount: sum(details.map(({ amount }) => amount)),
        groups: reportGroups(details, filter.groupBy),
      };
    });
    res.json(result);
  }),
);

export default router;
