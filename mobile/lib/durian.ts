import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useAuthStore, userScope } from "../store/authStore";
import { api } from "./api";
import type { Page } from "./types";

export interface Ticket {
  id: string;
  number: string;
  plate: string;
  gateName: string;
  endedAt: string | null;
  kg: number;
}

export interface Grade {
  code: string;
  classification: string;
  kg: number;
}

export interface Overview {
  kg: number;
  trips: number;
  purchases?: { amount: number; missingPrices: number };
  activeGates: number;
  gates: {
    id: string;
    name: string;
    ticket: Pick<Ticket, "id" | "number" | "plate" | "kg"> | null;
    grades: Grade[];
  }[];
}

export interface Detail {
  ticket: Ticket & {
    supplier: string;
    status: "running" | "completed";
    startedAt: string | null;
  };
  items: (Grade & {
    count: number;
    description: string;
    unitPrice: number | null;
    amount: number | null;
  })[];
  events: { id: string; classification: string; at: string; kg: number }[];
  amount: number;
  tax: number;
  total: number;
  missingPrices: boolean;
}

export type GroupBy = "ticket" | "gate" | "grade" | "supplier";
export interface Report {
  kg: number;
  trips: number;
  amount: number;
  groups: {
    key: string;
    label: string;
    kg: number;
    trips: number;
    amount: number;
  }[];
}

function useDurianOptions(path: string, enabled: boolean) {
  const user = useAuthStore((state) => state.user);
  return {
    queryKey: ["durian", ...userScope(user), path],
    enabled: enabled && user?.permissions?.includes("durian:read") === true,
    networkMode: "always",
    staleTime: 30_000,
    gcTime: Infinity,
    refetchOnWindowFocus: true,
  } as const;
}
export function useDurianQuery<T>(path: string, enabled = true) {
  return useQuery({
    ...useDurianOptions(path, enabled),
    queryFn: () => api<T>(path),
  });
}
export function useDurianPages<T>(path: string) {
  return useInfiniteQuery({
    ...useDurianOptions(path, true),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => api<Page<T>>(path + "page=" + pageParam),
    getNextPageParam: (last) =>
      last.page * last.limit < last.total ? last.page + 1 : undefined,
  });
}

const vnDate = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Asia/Ho_Chi_Minh",
});
export function stationToday() {
  const parts = vnDate.formatToParts(new Date());
  return ["year", "month", "day"]
    .map((type) => parts.find((part) => part.type === type)?.value)
    .join("-");
}
const weights = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 4 });
const prices = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });
export const kg = (value: number) => weights.format(value);
export const money = (value: number) => prices.format(value) + " ₫";
export function stationTime(value: string | null) {
  if (!value) return "—";
  const iso = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : value + "+07:00";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "—";
  return date.toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
