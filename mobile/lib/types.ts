export interface Weighing {
  price_total: number | string | null;
  id: number;
  formcode: string;
  truct_no: string;
  customer_name: string | null;
  items_name: string | null;
  date_in: string;
  date_out: string | null;
  weight_1: number | string;
  weight_2: number | string | null;
  net_weight: number | string | null;
  notes: string | null;
  createby: number;
  idusergroup: number;
  creator_name: string | null;
  station_name: string | null;
}
export interface Station {
  id: number;
  name: string;
  address: string;
  phonenumber: string;
  enabled: boolean;
  version: string;
  startdate: string | null;
  enddate: string | null;
}
export interface Account {
  id: number;
  username: string;
  stationId: number;
  roleId: number;
  roleName: string;
  enabled: boolean;
  viewAll: boolean;
  version: string;
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
export interface Summary {
  summary: {
    revenue: number | string;
    customers: number;
    vehicles: number;
    totalRecords: number;
    totalNet: number | string;
    pending: number;
    complete: number;
  };
  today: { records: number; weight: number | string; revenue: number | string };
  trend: { day: string; records: number; weight: number | string }[];
  trendUnit: "day" | "month" | "year";
  system?: { stations: number; activeStations: number; accounts: number };
}

export interface ReportGroupRow {
  groupKey: string;
  label: string;
  stationName: string | null;
  records: number;
  weight: number | string;
  revenue: number | string;
  pending: number | string;
}
