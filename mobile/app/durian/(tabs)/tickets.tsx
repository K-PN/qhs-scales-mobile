import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { DurianHeader, LoadState, ds } from "../../../components/DurianUI";
import { ReceiptRow, SearchBar, Segments } from "../../../components/BrowseUI";
import { Button, Chips, Field, Sheet } from "../../../components/UI";
import { queryString } from "../../../lib/api";
import {
  kg,
  stationTime,
  stationToday,
  useDurianPages,
  useDurianQuery,
  type Ticket,
} from "../../../lib/durian";
import { c, ui } from "../../../lib/theme";
import { useAuthStore } from "../../../store/authStore";

type Drill = {
  startDate?: string;
  endDate?: string;
  groupBy?: string;
  groupKey?: string;
  label?: string;
};
type Filters = { startDate: string; endDate: string; gateId: string };
const empty: Filters = { startDate: "", endDate: "", gateId: "" };
const dates = [
  { value: "recent", label: "Gần đây" },
  { value: "today", label: "Hôm nay" },
  { value: "custom", label: "Khoảng ngày" },
] as const;
function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export default function DurianTickets() {
  const drill = useLocalSearchParams<Drill>();
  return <TicketList key={JSON.stringify(drill)} drill={drill} />;
}

function TicketList({ drill }: { drill: Drill }) {
  const router = useRouter();
  const canRead = useAuthStore((state) =>
    state.user?.permissions?.includes("durian:read"),
  );
  const [filter, setFilter] = useState<Filters>(() => ({
    ...empty,
    startDate: drill.startDate ?? "",
    endDate: drill.endDate ?? "",
  }));
  const [draft, setDraft] = useState(filter);
  const [mode, setMode] = useState<"recent" | "today" | "custom">("recent");
  const [filterOpen, setFilterOpen] = useState(false);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const today = stationToday();
  useEffect(() => {
    const timer = setTimeout(() => setSearch(text.trim()), 250);
    return () => clearTimeout(timer);
  }, [text]);
  const gates = useDurianQuery<{ items: { id: string; name: string }[] }>(
    "/durian/gates?format=items",
    filterOpen || !!filter.gateId,
  );
  const groupFilter = drill.groupBy
    ? "&groupBy=" +
      encodeURIComponent(drill.groupBy) +
      "&groupKey=" +
      encodeURIComponent(drill.groupKey ?? "")
    : "";
  const tickets = useDurianPages<Ticket>(
    "/durian/tickets?" +
      queryString({ ...filter, q: search, limit: 20 }) +
      groupFilter +
      "&",
  );
  const items = Array.from(
    new Map(
      tickets.data?.pages.flatMap(({ items }) =>
        items.map((item) => [item.id, item] as const),
      ),
    ).values(),
  );
  const active = !!(filter.startDate || filter.endDate || filter.gateId);
  function showFilters() {
    setDraft(filter);
    setMode(
      !filter.startDate && !filter.endDate
        ? "recent"
        : filter.startDate === today && filter.endDate === today
          ? "today"
          : "custom",
    );
    setError("");
    setFilterOpen(true);
  }
  function apply() {
    if (
      mode === "custom" &&
      (!validDate(draft.startDate) ||
        !validDate(draft.endDate) ||
        draft.startDate > draft.endDate)
    ) {
      return setError("Kiểm tra ngày bắt đầu và ngày kết thúc.");
    }
    setFilter({
      gateId: draft.gateId,
      startDate:
        mode === "recent" ? "" : mode === "today" ? today : draft.startDate,
      endDate:
        mode === "recent" ? "" : mode === "today" ? today : draft.endDate,
    });
    setFilterOpen(false);
  }
  return (
    <View style={ds.page}>
      <DurianHeader
        title="Phiếu cân"
        updatedAt={tickets.dataUpdatedAt}
        onRefresh={canRead ? () => void tickets.refetch() : undefined}
      />
      {canRead ? (
        <View style={[ui.content, { paddingVertical: 10, gap: 7 }]}>
          <SearchBar
            label="Tìm biển số hoặc số phiếu"
            value={text}
            onChange={setText}
            filter={showFilters}
            active={active}
          />
          {drill.groupBy ? (
            <View style={ds.between}>
              <Text style={ui.muted}>{drill.label || "Nhóm báo cáo"}</Text>
              <Button
                secondary
                title="Xóa lọc nhóm"
                onPress={() => router.replace("/durian/tickets")}
              />
            </View>
          ) : null}
        </View>
      ) : null}
      <FlatList
        testID="durian-ticket-list"
        style={{ flex: 1 }}
        contentContainerStyle={[ds.content, { paddingTop: 0, gap: 8 }]}
        data={items}
        keyExtractor={(item) => item.id}
        refreshing={tickets.isRefetching && !tickets.isFetchingNextPage}
        onRefresh={canRead ? () => void tickets.refetch() : undefined}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onEndReachedThreshold={0.35}
        onEndReached={() => {
          if (
            tickets.hasNextPage &&
            !tickets.isFetching &&
            !tickets.isFetchNextPageError
          )
            void tickets.fetchNextPage();
        }}
        ListHeaderComponent={
          !canRead ? (
            <Text style={ds.warning}>
              Tài khoản chưa được cấp quyền xem phiếu cân.
            </Text>
          ) : tickets.isLoading ||
            (tickets.error && !tickets.isFetchNextPageError) ? (
            <LoadState
              loading={tickets.isLoading}
              error={tickets.error}
              cached={!!tickets.data}
              retry={() => void tickets.refetch()}
            />
          ) : null
        }
        ListEmptyComponent={
          tickets.data ? (
            <Text style={ui.muted}>Không có phiếu phù hợp.</Text>
          ) : null
        }
        ListFooterComponent={
          tickets.isFetchingNextPage ? (
            <ActivityIndicator color={c.blue} />
          ) : tickets.hasNextPage ? (
            <Button
              secondary
              title={tickets.isFetchNextPageError ? "Tải lại" : "Xem thêm"}
              onPress={() => void tickets.fetchNextPage()}
            />
          ) : null
        }
        renderItem={({ item }) => (
          <ReceiptRow
            title={item.plate || "Chưa có biển số"}
            meta={[item.number, item.gateName, stationTime(item.endedAt)]
              .filter(Boolean)
              .join(" · ")}
            value={kg(item.kg)}
            unit="kg"
            onPress={() =>
              router.push({
                pathname: "/durian/ticket/[id]",
                params: { id: item.id },
              })
            }
          />
        )}
      />
      <Sheet
        visible={filterOpen}
        title="Bộ lọc"
        onClose={() => setFilterOpen(false)}
        footer={
          <View style={ds.between}>
            <Button
              secondary
              title="Xóa bộ lọc"
              onPress={() => {
                setFilter(empty);
                setFilterOpen(false);
              }}
            />
            <Button title="Áp dụng" onPress={apply} />
          </View>
        }
      >
        <Segments
          items={dates}
          value={mode}
          onChange={(next) => {
            setMode(next);
            setError("");
            if (next === "custom")
              setDraft((current) => ({
                ...current,
                startDate: current.startDate || today,
                endDate: current.endDate || today,
              }));
          }}
        />
        {mode === "custom" ? (
          <>
            <Field
              label="Từ ngày"
              placeholder="YYYY-MM-DD"
              value={draft.startDate}
              onChange={(value) =>
                setDraft((current) => ({ ...current, startDate: value }))
              }
            />
            <Field
              label="Đến ngày"
              placeholder="YYYY-MM-DD"
              value={draft.endDate}
              onChange={(value) =>
                setDraft((current) => ({ ...current, endDate: value }))
              }
            />
          </>
        ) : null}
        <Text style={ui.label}>Cửa cân</Text>
        <Chips
          items={[
            { value: "", label: "Tất cả cửa" },
            ...(gates.data?.items.map((gate) => ({
              value: gate.id,
              label: gate.name,
            })) ?? []),
          ]}
          value={draft.gateId}
          onChange={(gateId) => setDraft((current) => ({ ...current, gateId }))}
        />
        <LoadState
          loading={gates.isLoading}
          error={gates.error}
          cached={!!gates.data}
          retry={() => void gates.refetch()}
        />
        {error ? (
          <Text accessibilityRole="alert" style={ui.error}>
            {error}
          </Text>
        ) : null}
      </Sheet>
    </View>
  );
}
