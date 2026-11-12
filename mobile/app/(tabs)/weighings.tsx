import { useEffect, useState } from "react";
import {
  FlatList,
  Text,
  View,
  Pressable,
  RefreshControl,
  TextInput,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { api, queryString } from "../../lib/api";
import { Page, Weighing, Station } from "../../lib/types";
import { c, ui, number, dateTime, localDay } from "../../lib/theme";
import { useAuthStore } from "../../store/authStore";
import AppHeader from "../../components/AppHeader";
import Calendar from "../../components/Calendar";
import { Badge, Button, Chips, Field, Sheet, State } from "../../components/UI";
const defaults = {
  q: "",
  startDate: "",
  endDate: "",
  status: "all",
  stationId: "",
};
function Detail({ id, onClose }: { id: number; onClose: () => void }) {
  const user = useAuthStore((s) => s.user)!;
  const q = useQuery({
    queryKey: ["weighing", user.role, user.id, id],
    queryFn: () => api<{ item: Weighing }>("/weighings/" + id),
  });
  const w = q.data?.item;
  return (
    <Sheet visible title="Chi tiết phiếu cân" onClose={onClose}>
      <State
        loading={q.isPending}
        error={q.error}
        onRetry={() => void q.refetch()}
      />
      {w ? (
        <>
          <View
            style={[ui.card, { backgroundColor: c.navy, borderColor: c.navy }]}
          >
            <Text style={{ fontSize: 12, color: "#DBEEDC" }}>
              PHIẾU {w.formcode}
            </Text>
            <Text style={{ fontSize: 30, fontWeight: "800", color: "white" }}>
              {w.truct_no}
            </Text>
            <Text style={{ color: "#DBEEDC" }}>{w.station_name?.trim()}</Text>
          </View>
          <Badge
            label={w.weight_2 === null ? "Chờ cân lần 2" : "Đã cân lần 2"}
            tone={w.weight_2 === null ? "amber" : "green"}
          />
          <View style={ui.card}>
            {[
              ["Khách hàng", w.customer_name || "—"],
              ["Hàng hóa", w.items_name || "—"],
              ["Người cân", w.creator_name || "—"],
              ["Thời gian vào", dateTime(w.date_in)],
              ["Thời gian ra", dateTime(w.date_out)],
              ["Cân lần 1", number(w.weight_1) + " kg"],
              [
                "Cân lần 2",
                w.weight_2 === null ? "—" : number(w.weight_2) + " kg",
              ],
              [
                "Khối lượng hàng",
                w.net_weight === null ? "—" : number(w.net_weight) + " kg",
              ],
              ["Thành tiền", number(w.price_total) + " đ"],
              ...(w.notes ? [["Ghi chú", w.notes]] : []),
            ].map(([label, value]) => (
              <View key={label} style={{ gap: 4, paddingVertical: 5 }}>
                <Text style={ui.muted}>{label}</Text>
                <Text selectable style={ui.body}>
                  {value}
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </Sheet>
  );
}
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
    queryKey: ["weighings", user.role, user.id, filter],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      api<Page<Weighing>>(
        "/weighings?" + queryString({ ...filter, page: pageParam, limit: 20 }),
      ),
    getNextPageParam: (last) =>
      last.page * last.limit < last.total ? last.page + 1 : undefined,
  });
  const stations = useQuery({
    queryKey: ["stationLookup", stationSearch],
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
  return (
    <View style={ui.screen}>
      <AppHeader />
      <FlatList
        data={items}
        keyExtractor={(w) => String(w.id)}
        contentContainerStyle={ui.content}
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
          <View style={{ gap: 14, marginBottom: 14 }}>
            <View style={[ui.row, { justifyContent: "space-between" }]}>
              <Text style={ui.title}>Dữ liệu cân</Text>
              <Text style={ui.muted}>{number(total)} phiếu</Text>
            </View>
            <View style={ui.row}>
              <View
                style={[
                  ui.row,
                  {
                    flex: 1,
                    backgroundColor: "white",
                    borderWidth: 1,
                    borderColor: c.line,
                    borderRadius: 14,
                    paddingHorizontal: 12,
                    height: 48,
                    gap: 8,
                  },
                ]}
              >
                <Ionicons name="search-outline" color={c.muted} size={20} />
                <TextInput
                  accessibilityLabel="Tìm phiếu cân"
                  placeholder="Biển số, mã phiếu, khách hàng"
                  placeholderTextColor={c.muted}
                  value={search}
                  onChangeText={setSearch}
                  returnKeyType="search"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 14,
                    color: c.text,
                    paddingVertical: 10,
                  }}
                />
                {search ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Xóa tìm kiếm"
                    onPress={() => setSearch("")}
                    hitSlop={10}
                  >
                    <Ionicons name="close-circle" color={c.muted} size={18} />
                  </Pressable>
                ) : null}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Bộ lọc"
                onPress={() => {
                  Keyboard.dismiss();
                  setDraft(filter);
                  setCalendar(null);
                  setError("");
                  setOpen(true);
                }}
                style={{
                  padding: 13,
                  borderRadius: 14,
                  backgroundColor: active ? c.blue : c.soft,
                }}
              >
                <Ionicons
                  name="options-outline"
                  size={22}
                  color={active ? "white" : c.blue}
                />
              </Pressable>
            </View>
            <Chips
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
            <State
              loading={q.isPending}
              error={q.error && !q.data ? q.error : null}
              onRetry={() => void q.refetch()}
            />
          </View>
        }
        ListEmptyComponent={!q.isPending && !q.error ? <State empty /> : null}
        renderItem={({ item: w }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={"Xem phiếu " + w.formcode}
            onPress={() => setSelected(w.id)}
            style={[ui.card, { marginBottom: 10, padding: 16, gap: 8 }]}
          >
            <View style={[ui.row, { justifyContent: "space-between" }]}>
              <Text style={[ui.heading, { fontSize: 20 }]}>{w.truct_no}</Text>
              <Text style={{ fontSize: 18, fontWeight: "800", color: c.blue }}>
                {w.net_weight === null ? "—" : number(w.net_weight)}{" "}
                <Text style={{ fontSize: 12, fontWeight: "400" }}>kg</Text>
              </Text>
            </View>
            <Text numberOfLines={1} style={ui.muted}>
              {w.customer_name || w.items_name || "—"}
            </Text>
            <View style={[ui.row, { justifyContent: "space-between" }]}>
              <Text style={{ fontSize: 12, color: c.muted }}>
                #{w.formcode} · {dateTime(w.date_in)}
              </Text>
              {w.weight_2 === null ? (
                <Ionicons
                  accessibilityLabel="Chờ cân lần 2"
                  name="time-outline"
                  size={18}
                  color={c.amber}
                />
              ) : (
                <Ionicons name="checkmark-circle" size={18} color={c.blue} />
              )}
            </View>
            {user.role === "admin" ? (
              <Text numberOfLines={1} style={{ fontSize: 12, color: c.muted }}>
                {w.station_name?.trim() || "—"}
              </Text>
            ) : null}
          </Pressable>
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
        <Detail id={selected} onClose={() => setSelected(null)} />
      ) : null}
      <Sheet visible={open} title="Bộ lọc" onClose={() => setOpen(false)}>
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
            {stations.data?.items.map((s) => (
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
        <Button title="Áp dụng" onPress={apply} />
        <Button
          secondary
          title="Xóa bộ lọc"
          onPress={() => {
            setDraft(defaults);
            setFilter({ ...defaults, q: search.trim() });
            setPeriod("all");
            setOpen(false);
          }}
        />
      </Sheet>
    </View>
  );
}
