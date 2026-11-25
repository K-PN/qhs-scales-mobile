import { Decimal } from "decimal.js";

export interface DurianRecord {
  id: string;
  gateId: string | null;
  state: string | null;
  payload: string;
}

export interface GateData {
  Name?: string;
  Enabled: boolean;
  Order?: number;
}

export interface TicketData {
  IsTest: boolean;
  Number: string;
  Plate?: string;
  GateName?: string;
  Supplier?: string;
  Arrival: string;
  StartedAt?: string;
  StoppedAt?: string;
  FinalizedAt?: string;
  Departure?: string;
  Description?: string;
  Prices?: Record<string, number> | null;
  ItemNames?: Record<string, string> | null;
  ItemDescriptions?: Record<string, string> | null;
  TaxAmount?: number;
}

export interface EventData {
  TicketId: string;
  IsTest: boolean;
  Voided: boolean;
  Problem?: string;
  ReceivedAt: string;
  ItemType: string;
  ItemName?: string;
  Weight: number;
}

export function parseData<T>(record: DurianRecord): T | null {
  try {
    const value = JSON.parse(record.payload);
    return value && typeof value === "object" && !Array.isArray(value)
      ? value
      : null;
  } catch {
    return null;
  }
}

export function sum(values: number[]) {
  return values
    .reduce((total, value) => total.plus(value), new Decimal(0))
    .toNumber();
}

function gradeName(code: string) {
  return code === "e" ? "Dạt" : "Hàng " + code.toUpperCase();
}

export function summarizeTicket(
  record: DurianRecord,
  eventRecords: DurianRecord[],
) {
  const data = parseData<TicketData>(record)!;
  const events: {
    id: string;
    code: string;
    classification: string;
    at: string;
    kg: number;
  }[] = [];
  const groups = new Map<
    string,
    { classification: string; weights: number[] }
  >();
  for (const eventRecord of eventRecords) {
    const event = parseData<EventData>(eventRecord);
    if (
      eventRecord.state !== "Accepted" ||
      !event ||
      event.TicketId !== record.id ||
      event.IsTest !== false ||
      event.Voided !== false ||
      event.Problem ||
      typeof event.ItemType !== "string" ||
      !event.ItemType ||
      !Number.isFinite(event.Weight)
    )
      continue;
    const code = event.ItemType;
    let group = groups.get(code);
    if (!group) {
      group = {
        classification:
          data.ItemNames?.[code] || event.ItemName?.trim() || gradeName(code),
        weights: [],
      };
      groups.set(code, group);
    }
    group.weights.push(event.Weight);
    events.push({
      id: eventRecord.id,
      code,
      classification: group.classification,
      at: event.ReceivedAt,
      kg: event.Weight,
    });
  }
  const items = [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, group]) => {
      const kg = sum(group.weights);
      const price = data.Prices?.[code];
      const unitPrice = typeof price === "number" && price > 0 ? price : null;
      return {
        code,
        classification: group.classification,
        kg,
        count: group.weights.length,
        description: data.ItemDescriptions?.[code] ?? data.Description ?? "",
        unitPrice,
        amount:
          unitPrice === null
            ? null
            : new Decimal(kg)
                .times(unitPrice)
                .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
                .toNumber(),
      };
    });
  const amount = sum(items.map((item) => item.amount ?? 0));
  const tax = data.TaxAmount ?? 0;
  return {
    ticket: {
      id: record.id,
      number: data.Number,
      plate: data.Plate ?? "",
      gateId: record.gateId ?? "",
      gateName: data.GateName ?? "",
      supplier: data.Supplier?.trim() ?? "",
      status:
        record.state === "Running"
          ? ("running" as const)
          : ("completed" as const),
      arrival: data.Arrival,
      startedAt: data.StartedAt ?? null,
      endedAt: data.StoppedAt ?? data.FinalizedAt ?? data.Departure ?? null,
      kg: sum(items.map((item) => item.kg)),
    },
    items,
    events: events.sort(
      (a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id),
    ),
    amount,
    tax,
    total: sum([amount, tax]),
    missingPrices:
      !items.length || items.some((item) => item.unitPrice === null),
  };
}

export type DurianDetail = ReturnType<typeof summarizeTicket>;
export type GroupBy = "ticket" | "gate" | "grade" | "supplier";

export function reportGroups(details: DurianDetail[], groupBy: GroupBy) {
  const groups = new Map<
    string,
    {
      key: string;
      label: string;
      tickets: Set<string>;
      weights: number[];
      amounts: number[];
    }
  >();
  for (const { ticket, items, amount } of details) {
    let entries = [
      {
        key: ticket.id,
        label: `Phiếu ${ticket.number} · ${ticket.plate}`,
        kg: ticket.kg,
        amount,
      },
    ];
    if (groupBy === "gate") {
      entries = [
        { key: ticket.gateId, label: ticket.gateName, kg: ticket.kg, amount },
      ];
    } else if (groupBy === "supplier") {
      entries = [
        {
          key: ticket.supplier,
          label: ticket.supplier || "Chưa có nhà cung cấp",
          kg: ticket.kg,
          amount,
        },
      ];
    } else if (groupBy === "grade") {
      entries = items.map((item) => ({
        key: JSON.stringify([item.code, item.classification]),
        label: item.classification,
        kg: item.kg,
        amount: item.amount ?? 0,
      }));
    }
    for (const entry of entries) {
      let group = groups.get(entry.key);
      if (!group) {
        group = {
          key: entry.key,
          label: entry.label,
          tickets: new Set(),
          weights: [],
          amounts: [],
        };
        groups.set(entry.key, group);
      }
      group.tickets.add(ticket.id);
      group.weights.push(entry.kg);
      group.amounts.push(entry.amount);
    }
  }
  const sorted = [...groups.values()];
  if (groupBy === "grade")
    sorted.sort((a, b) => a.key.localeCompare(b.key, "vi"));
  if (groupBy === "gate" || groupBy === "supplier")
    sorted.sort((a, b) =>
      a.label.localeCompare(b.label, "vi", { numeric: true }),
    );
  return sorted.map((group) => ({
    key: group.key,
    label: group.label,
    trips: group.tickets.size,
    kg: sum(group.weights),
    amount: sum(group.amounts),
  }));
}
