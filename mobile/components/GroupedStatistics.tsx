import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api, queryString } from "../lib/api";
import { Page, ReportGroupRow } from "../lib/types";
import { number, ui } from "../lib/theme";
import { useAuthStore, userScope } from "../store/authStore";
import { Button, Chips, Field, Pager, State } from "./UI";

type Group = "customer" | "item" | "vehicle";
const groups = [
  { value: "customer", label: "Khách hàng" },
  { value: "item", label: "Hàng hóa" },
  { value: "vehicle", label: "Biển số xe" },
];

export default function GroupedStatistics({
  startDate,
  endDate,
}: {
  startDate: string;
  endDate: string;
}) {
  const user = useAuthStore((s) => s.user)!;
  const [groupBy, setGroupBy] = useState<Group>("customer");
  const [visible, setVisible] = useState(false);
  return (
    <View style={ui.card}>
      <Text style={ui.heading}>Thống kê chi tiết</Text>
      <Chips
        items={groups}
        value={groupBy}
        onChange={(value) => setGroupBy(value as Group)}
      />
      <Button
        secondary
        title={visible ? "Ẩn thống kê" : "Xem thống kê"}
        onPress={() => setVisible((current) => !current)}
      />
      {visible ? (
        <GroupSearch
          key={[user.role, user.id, user.stationId, groupBy].join(":")}
          groupBy={groupBy}
          startDate={startDate}
          endDate={endDate}
        />
      ) : null}
    </View>
  );
}

function GroupSearch({
  groupBy,
  startDate,
  endDate,
}: {
  groupBy: Group;
  startDate: string;
  endDate: string;
}) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);
  const label =
    groupBy === "customer"
      ? "Tìm khách hàng"
      : groupBy === "item"
        ? "Tìm hàng hóa"
        : "Tìm biển số xe";
  return (
    <View style={{ gap: 12 }}>
      <Field
        label={label}
        value={search}
        onChange={(value) => setSearch(value.slice(0, 100))}
        placeholder={
          groupBy === "customer"
            ? "Nhập tên hoặc mã khách hàng"
            : groupBy === "item"
              ? "Nhập tên hàng hóa"
              : "Nhập biển số xe"
        }
      />
      {search ? (
        <Button
          secondary
          title="Xóa tìm kiếm thống kê"
          onPress={() => setSearch("")}
        />
      ) : null}
      <GroupRows
        key={[startDate, endDate, debouncedSearch].join(":")}
        groupBy={groupBy}
        startDate={startDate}
        endDate={endDate}
        search={debouncedSearch}
      />
    </View>
  );
}

function GroupRows({
  groupBy,
  startDate,
  endDate,
  search,
}: {
  groupBy: Group;
  startDate: string;
  endDate: string;
  search: string;
}) {
  const user = useAuthStore((s) => s.user)!;
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: [
      "reportGroups",
      ...userScope(user),
      groupBy,
      startDate,
      endDate,
      search,
      page,
    ],
    queryFn: () =>
      api<Page<ReportGroupRow>>(
        "/reports/groups?" +
          queryString({ groupBy, startDate, endDate, search, page, limit: 10 }),
      ),
  });
  return (
    <View style={{ gap: 16 }}>
      <Text style={ui.muted}>
        Theo kỳ đang chọn · Sắp xếp theo thành tiền giảm dần
      </Text>
      <State
        loading={query.isPending}
        error={query.error}
        empty={query.data?.total === 0}
        onRetry={() => void query.refetch()}
      />
      {!query.isError && query.data ? (
        <>
          {query.data.items.map((row) => (
            <View key={row.groupKey} style={{ gap: 8 }}>
              <View style={ui.separator} />
              <Text selectable style={ui.heading}>
                {row.label}
              </Text>
              {user.role === "admin" && row.stationName ? (
                <Text style={ui.muted}>{row.stationName.trim()}</Text>
              ) : null}
              <View
                style={[
                  ui.row,
                  { justifyContent: "space-between", flexWrap: "wrap" },
                ]}
              >
                <Text style={ui.body}>{number(row.records)} lượt cân</Text>
                <Text style={ui.body}>{number(row.weight)} kg</Text>
              </View>
              <Text style={ui.body}>Thành tiền: {number(row.revenue)} đ</Text>
              {Number(row.pending) > 0 ? (
                <Text style={ui.muted}>
                  Chờ cân lần 2: {number(row.pending)}
                </Text>
              ) : null}
            </View>
          ))}
          {query.data.total > 10 || page > 1 ? (
            <Pager
              page={page}
              total={query.data.total}
              limit={10}
              onChange={setPage}
            />
          ) : null}
        </>
      ) : null}
    </View>
  );
}
