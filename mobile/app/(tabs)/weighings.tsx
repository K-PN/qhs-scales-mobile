import { useEffect, useState } from "react";
import {
  FlatList,
  Text,
  View,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api, queryString } from "../../lib/api";
import { Page, Weighing, Station } from "../../lib/types";
import { c, ui, number, dateTime, localDay } from "../../lib/theme";
import { useAuthStore, userScope } from "../../store/authStore";
import AppHeader from "../../components/AppHeader";
import WeighingDetail from "../../components/WeighingDetail";
import Calendar from "../../components/Calendar";
import { ReceiptRow, SearchBar, Segments } from "../../components/BrowseUI";
import { Button, Chips, Field, Sheet, State } from "../../components/UI";
const defaults = {
  q: "",
  startDate: "",
  endDate: "",
  status: "all",
  stationId: "",
};
export default function Weighings() {
  const user = useAuthStore((s) => s.user)!;
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState(defaults),
    [draft, setDraft] = useState(defaults),
    [period, setPeriod] = useState("all"),
    [open, setOpen] = useState(false),
    [selected, setSelected] = useState<number | null>(null),
    [calendar, setCalendar] = useState<"startDate" | "endDate" | null>(null),
    [error, setError] = useState(""),
    [stationSearch, setStationSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(
      () => setFilter((f) => ({ ...f, q: search.trim() })),
      350,
    );
    return () => clearTimeout(timer);
  }, [search]);
  const q = useInfiniteQuery({
    queryKey: ["weighings", ...userScope(user), filter],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      api<Page<Weighing>>(
        "/weighings?" + queryString({ ...filter, page: pageParam, limit: 20 }),
      ),
    getNextPageParam: (last) =>
      last.page * last.limit < last.total ? last.page + 1 : undefined,
  });
  const stations = useQuery({
    queryKey: ["stationLookup", ...userScope(user), stationSearch],
    queryFn: () =>
      api<Page<Station>>(
        "/admin/stations?" + queryString({ q: stationSearch, limit: 50 }),
      ),
    enabled: open && user.role === "admin",
  });
  const items = Array.from(
      new Map(
        (q.data?.pages.flatMap((p) => p.items) || []).map((w) => [w.id, w]),
      ).values(),
    ),
    total = q.data?.pages[0]?.total || 0,
    active =
      filter.status !== "all" || !!filter.stationId || period === "custom";
  function preset(value: string) {
    if (value === "custom") {
      setDraft(filter);
      setOpen(true);
      return;
    }
    setPeriod(value);
    setFilter((f) => ({
      ...f,
      startDate:
        value === "today"
          ? localDay()
          : value === "month"
            ? localDay().slice(0, 8) + "01"
            : "",
      endDate: value === "all" ? "" : localDay(),
    }));
  }
  function apply() {
    if (draft.startDate && draft.endDate && draft.startDate > draft.endDate) {
      setError("Ngày bắt đầu phải trước ngày kết thúc.");
      return;
    }
    setFilter({ ...draft, q: search.trim() });
    if (
      draft.startDate !== filter.startDate ||
      draft.endDate !== filter.endDate
    )
      setPeriod("custom");
    setOpen(false);
    Keyboard.dismiss();
  }
  function reset() {
    setDraft(defaults);
    setFilter({ ...defaults, q: search.trim() });
    setPeriod("all");
    setOpen(false);
  }
  function showFilters() {
    setDraft(filter);
    setCalendar(null);
    setError("");
    setOpen(true);
  }
  return (
    <View style={ui.screen}>
      <AppHeader title="Dữ liệu cân" onRefresh={() => void q.refetch()} />
      <View style={[ui.content, { paddingVertical: 10, gap: 8 }]}>
        <SearchBar
          label="Tìm phiếu cân"
          placeholder="Biển số, số phiếu, khách hàng"
          value={search}
          onChange={setSearch}
          filter={showFilters}
          active={active}
        />
        <Segments
          value={period}
          onChange={preset}
          items={[
            { value: "all", label: "Tất cả" },
            { value: "today", label: "Hôm nay" },
            { value: "month", label: "Tháng này" },
            ...(period === "custom"
              ? [{ value: "custom", label: "Tùy chọn" }]
              : []),
          ]}
        />
      </View>
      <FlatList
        data={items}
        keyExtractor={(w) => String(w.id)}
        contentContainerStyle={[ui.content, { paddingTop: 0, gap: 8 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            tintColor={c.blue}
            refreshing={q.isRefetching && !q.isFetchingNextPage}
            onRefresh={() => void q.refetch()}
          />
        }
        onEndReachedThreshold={0.3}
        onEndReached={() => {
          if (q.hasNextPage && !q.isFetchingNextPage && !q.isFetchNextPageError)
            void q.fetchNextPage();
        }}
        ListHeaderComponent={
          q.isPending || (q.error && !q.data) ? (
            <State
              loading={q.isPending}
              error={q.error}
              onRetry={() => void q.refetch()}
            />
          ) : total > 0 ? (
            <Text style={ui.muted}>{number(total)} phiếu</Text>
          ) : null
        }
        ListEmptyComponent={!q.isPending && !q.error ? <State empty /> : null}
        renderItem={({ item: w }) => (
          <ReceiptRow
            title={w.truct_no || "Chưa có biển số"}
            meta={w.formcode + " · " + dateTime(w.date_in)}
            secondary={
              user.role === "admin"
                ? w.station_name?.trim()
                : w.customer_name || w.items_name || undefined
            }
            value={w.net_weight === null ? "—" : number(w.net_weight)}
            unit={w.net_weight === null ? undefined : "kg"}
            pending={w.weight_2 === null}
            label={"Xem phiếu " + w.formcode}
            onPress={() => setSelected(w.id)}
          />
        )}
        ListFooterComponent={
          q.isFetchingNextPage ? (
            <ActivityIndicator style={{ padding: 16 }} color={c.blue} />
          ) : q.isFetchNextPageError ? (
            <Button
              title="Tải lại"
              secondary
              onPress={() => void q.fetchNextPage()}
            />
          ) : q.hasNextPage ? (
            <Button
              title="Xem thêm"
              secondary
              onPress={() => void q.fetchNextPage()}
            />
          ) : null
        }
      />
      {selected !== null ? (
        <WeighingDetail id={selected} stationId={filter.stationId} onClose={() => setSelected(null)} />
      ) : null}
      <Sheet
        visible={open}
        title="Bộ lọc"
        onClose={() => setOpen(false)}
        footer={
          <View
            style={[
              ui.row,
              { justifyContent: "space-between", flexWrap: "wrap" },
            ]}
          >
            <Button secondary title="Xóa bộ lọc" onPress={reset} />
            <Button title="Áp dụng" onPress={apply} />
          </View>
        }
      >
        <Text style={ui.label}>Thời gian</Text>
        <View style={ui.row}>
          {(["startDate", "endDate"] as const).map((key) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={
                key === "startDate" ? "Chọn từ ngày" : "Chọn đến ngày"
              }
              onPress={() => setCalendar(calendar === key ? null : key)}
              style={[ui.input, { flex: 1, gap: 6 }]}
            >
              <Text style={ui.muted}>
                {key === "startDate" ? "Từ ngày" : "Đến ngày"}
              </Text>
              <Text style={ui.body}>
                {draft[key]
                  ? draft[key].split("-").reverse().join("/")
                  : "Tất cả"}
              </Text>
            </Pressable>
          ))}
        </View>
        {calendar ? (
          <Calendar
            key={calendar + draft[calendar]}
            value={draft[calendar]}
            onChange={(v) => {
              setDraft((d) => ({ ...d, [calendar]: v }));
              setCalendar(null);
            }}
          />
        ) : null}
        <Text style={ui.label}>Trạng thái</Text>
        <Chips
          value={draft.status}
          onChange={(v) => setDraft((d) => ({ ...d, status: v }))}
          items={[
            { value: "all", label: "Tất cả" },
            { value: "pending", label: "Chờ lần 2" },
            { value: "complete", label: "Đã cân lần 2" },
          ]}
        />
        {user.role === "admin" ? (
          <>
            <Field
              label="Trạm cân"
              value={stationSearch}
              onChange={setStationSearch}
              placeholder="Tìm tên trạm"
            />
            <State
              loading={stations.isPending}
              error={stations.error}
              onRetry={() => void stations.refetch()}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => setDraft((d) => ({ ...d, stationId: "" }))}
              style={{
                padding: 12,
                backgroundColor: !draft.stationId ? c.soft : "white",
                borderRadius: 12,
              }}
            >
              <Text style={ui.body}>Tất cả trạm</Text>
            </Pressable>
            {stations.data?.items.filter((s) => s.stationType !== "durian").map((s) => (
              <Pressable
                accessibilityRole="button"
                key={s.id}
                onPress={() =>
                  setDraft((d) => ({ ...d, stationId: String(s.id) }))
                }
                style={{
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor:
                    draft.stationId === String(s.id) ? c.soft : "white",
                }}
              >
                <Text style={ui.body}>{s.name.trim() || "Trạm " + s.id}</Text>
              </Pressable>
            ))}
          </>
        ) : null}
        {error ? <Text style={ui.error}>{error}</Text> : null}
      </Sheet>
    </View>
  );
}
