import { useState } from "react";
import {
  ScrollView,
  Text,
  View,
  RefreshControl,
  Pressable,
  useWindowDimensions,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, queryClient } from "../../lib/api";
import type { Page, Summary, Weighing } from "../../lib/types";
import { c, ui, number, localDay } from "../../lib/theme";
import { useAuthStore, userScope } from "../../store/authStore";
import AppHeader from "../../components/AppHeader";
import OverviewHero from "../../components/OverviewHero";
import { Button, State } from "../../components/UI";
import GroupedStatistics from "../../components/GroupedStatistics";
import OverviewPeriod from "../../components/OverviewPeriod";
import WeighingDetail from "../../components/WeighingDetail";
import { ReceiptRow } from "../../components/BrowseUI";

function Metric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
}) {
  return (
    <View style={[ui.card, { flexGrow: 1, flexBasis: 128, gap: 6 }]}>
      <Ionicons name={icon} size={21} color={c.blue} />
      <Text
        style={{
          fontSize: 23,
          fontWeight: "800",
          color: c.text,
          fontVariant: ["tabular-nums"],
        }}
      >
        {value}
      </Text>
      <Text style={ui.muted}>{label}</Text>
    </View>
  );
}

function WeightTrend({ data, week }: { data: Summary; week: boolean }) {
  const { width } = useWindowDimensions();
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const amounts = new Map(
    data.trend.map((row) => [String(row.day).slice(0, 10), Number(row.weight)]),
  );
  const days = week
    ? Array.from({ length: 7 }, (_, index) => localDay(index - 6))
    : [...amounts.keys()];
  const selected =
    activeDay && days.includes(activeDay) ? activeDay : days.at(-1);
  const max = Math.max(1, ...amounts.values());
  const scroll = days.length > 7 || (width < 385 && days.length > 5);
  const label = (date: string) =>
    data.trendUnit === "year"
      ? date.slice(0, 4)
      : data.trendUnit === "month"
        ? date.slice(5, 7) + "/" + date.slice(0, 4)
        : date.slice(8) + "/" + date.slice(5, 7);
  const bars = days.map((day) => {
    const weight = amounts.get(day) ?? 0;
    const highlighted = day === selected;
    return (
      <Pressable
        key={day}
        accessibilityRole="button"
        accessibilityState={{ selected: highlighted }}
        accessibilityLabel={label(day) + " · " + number(weight) + " kg"}
        onPress={() => setActiveDay(day)}
        style={({ pressed }) => ({
          flex: scroll ? undefined : 1,
          minWidth: 44,
          minHeight: 102,
          justifyContent: "flex-end",
          gap: 6,
          alignItems: "center",
          opacity: pressed ? 0.75 : 1,
        })}
      >
        <View
          style={{
            width: "64%",
            height: Math.max(4, (weight / max) * 69),
            backgroundColor: highlighted ? c.blue : weight ? "#AAD0BF" : c.line,
            borderRadius: 5,
          }}
        />
        <Text
          style={[
            ui.muted,
            { fontSize: 11, fontWeight: highlighted ? "800" : "400" },
          ]}
        >
          {label(day)}
        </Text>
      </Pressable>
    );
  });
  return (
    <View style={[ui.card, { gap: 3 }]}>
      <View
        style={[
          ui.wrap,
          { justifyContent: "space-between", alignItems: "center", gap: 6 },
        ]}
      >
        <Text style={ui.heading}>
          {week ? "Khối lượng 7 ngày" : "Khối lượng theo kỳ"}
        </Text>
        {selected && amounts.size ? (
          <Text
            accessibilityLiveRegion="polite"
            style={[ui.body, { color: c.navy, fontWeight: "800" }]}
          >
            {number((amounts.get(selected) ?? 0) / 1000)} tấn
          </Text>
        ) : null}
      </View>
      {!amounts.size ? (
        <Text style={ui.muted}>Chưa có dữ liệu trong kỳ.</Text>
      ) : scroll ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 3 }}
        >
          {bars}
        </ScrollView>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
          {bars}
        </View>
      )}
    </View>
  );
}

export default function Dashboard() {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const admin = user?.role === "admin";
  const [range, setRange] = useState(() => ({
    startDate: localDay(),
    endDate: localDay(),
  }));
  const [selected, setSelected] = useState<number | null>(null);
  const { startDate, endDate } = range;
  const today = startDate === localDay() && startDate === endDate;
  const scope = userScope(user);
  const summary = useQuery({
    queryKey: ["summary", ...scope, startDate, endDate],
    queryFn: () =>
      api<Summary>("/reports?startDate=" + startDate + "&endDate=" + endDate),
    enabled: !!user,
  });
  const week = useQuery({
    queryKey: ["summary", ...scope, localDay(-6), localDay()],
    queryFn: () =>
      api<Summary>(
        "/reports?startDate=" + localDay(-6) + "&endDate=" + localDay(),
      ),
    enabled: !!user && !admin && today,
  });
  const recent = useQuery({
    queryKey: ["weighingsRecent", ...scope],
    queryFn: () => api<Page<Weighing>>("/weighings?limit=3"),
    enabled: !!user && !admin,
  });
  const data = summary.data;
  const trend = !admin && today ? week.data : data;
  const refresh = () => {
    void Promise.all([
      summary.refetch(),
      queryClient.invalidateQueries({ queryKey: ["reportGroups"] }),
      ...(!admin ? [recent.refetch(), ...(today ? [week.refetch()] : [])] : []),
    ]);
  };
  return (
    <View style={ui.screen}>
      <AppHeader
        title={admin ? "Quản trị hệ thống" : "Cân xe tải"}
        showStation={!admin}
        updatedAt={summary.dataUpdatedAt}
        onRefresh={refresh}
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            tintColor={c.blue}
            refreshing={summary.isRefetching}
            onRefresh={refresh}
          />
        }
        contentContainerStyle={ui.content}
      >
        <State
          loading={summary.isPending}
          error={summary.error}
          onRetry={refresh}
        />
        {admin && data?.system ? (
          <OverviewHero>
            <View style={[ui.wrap, { justifyContent: "space-between" }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Quản lý trạm cân"
                onPress={() => router.push("/(tabs)/stations")}
                style={{
                  flexGrow: 1,
                  flexBasis: 105,
                  minHeight: 50,
                  paddingVertical: 5,
                }}
              >
                <Text
                  style={{ color: c.yellow, fontSize: 31, fontWeight: "800" }}
                >
                  {number(data.system.stations)}
                </Text>
                <Text style={{ color: c.onHero, fontWeight: "700" }}>
                  Trạm cân <Ionicons name="chevron-forward" size={13} />
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Quản lý tài khoản"
                onPress={() => router.push("/(tabs)/accounts")}
                style={{
                  flexGrow: 1,
                  flexBasis: 105,
                  minHeight: 50,
                  paddingVertical: 5,
                }}
              >
                <Text
                  style={{ color: c.yellow, fontSize: 31, fontWeight: "800" }}
                >
                  {number(data.system.accounts)}
                </Text>
                <Text style={{ color: c.onHero, fontWeight: "700" }}>
                  Tài khoản <Ionicons name="chevron-forward" size={13} />
                </Text>
              </Pressable>
            </View>
          </OverviewHero>
        ) : null}
        {!admin && data ? (
          <OverviewHero
            label={today ? "Khối lượng hôm nay" : "Khối lượng trong kỳ"}
            value={number(Number(data.summary.totalNet) / 1000)}
            unit="tấn"
            icon="scale-outline"
            scene="truck"
          >
            <Text style={{ color: c.onHero, fontWeight: "700" }}>
              {number(data.summary.totalRecords)} lượt cân
            </Text>
          </OverviewHero>
        ) : null}
        <OverviewPeriod value={range} onChange={setRange} />
        {data ? (
          <View style={ui.wrap}>
            <Metric
              label="Thành tiền"
              value={number(data.summary.revenue) + " ₫"}
              icon="wallet-outline"
            />
            <Metric
              label="Chờ cân lần 2"
              value={number(data.summary.pending)}
              icon="time-outline"
            />
            {admin ? (
              <Metric
                label="Khối lượng"
                value={number(Number(data.summary.totalNet) / 1000) + " tấn"}
                icon="scale-outline"
              />
            ) : null}
            {admin ? (
              <Metric
                label="Lượt cân"
                value={number(data.summary.totalRecords)}
                icon="receipt-outline"
              />
            ) : null}
            {admin ? (
              <Metric
                label="Khách hàng"
                value={number(data.summary.customers)}
                icon="people-outline"
              />
            ) : null}
            {admin ? (
              <Metric
                label="Biển số xe"
                value={number(data.summary.vehicles)}
                icon="car-outline"
              />
            ) : null}
          </View>
        ) : null}
        {trend ? <WeightTrend data={trend} week={!admin && today} /> : null}
        {!admin && today && !trend ? (
          <State
            loading={week.isLoading}
            error={week.error}
            onRetry={() => void week.refetch()}
          />
        ) : null}
        {!admin ? (
          <View style={{ gap: 8 }}>
            <View
              style={[
                ui.wrap,
                { alignItems: "center", justifyContent: "space-between" },
              ]}
            >
              <Text style={ui.heading}>Phiếu gần đây</Text>
              <Button
                secondary
                title="Xem tất cả"
                onPress={() => router.push("/(tabs)/weighings")}
              />
            </View>
            <State
              loading={recent.isLoading}
              error={recent.error}
              empty={recent.data?.items.length === 0}
              onRetry={() => void recent.refetch()}
            />
            {recent.data?.items.map((receipt) => (
              <ReceiptRow
                key={receipt.id}
                title={receipt.truct_no || "Chưa có biển số"}
                meta={"Phiếu " + receipt.formcode}
                value={
                  receipt.net_weight === null
                    ? "—"
                    : number(Number(receipt.net_weight) / 1000)
                }
                unit={receipt.net_weight === null ? undefined : "tấn"}
                pending={receipt.weight_2 === null}
                onPress={() => setSelected(receipt.id)}
              />
            ))}
          </View>
        ) : null}
        {!admin && data ? (
          <View style={ui.wrap}>
            <Metric
              label="Khách hàng"
              value={number(data.summary.customers)}
              icon="people-outline"
            />
            <Metric
              label="Biển số xe"
              value={number(data.summary.vehicles)}
              icon="car-outline"
            />
          </View>
        ) : null}
        <GroupedStatistics startDate={startDate} endDate={endDate} />
      </ScrollView>
      {selected !== null ? (
        <WeighingDetail id={selected} onClose={() => setSelected(null)} />
      ) : null}
    </View>
  );
}
