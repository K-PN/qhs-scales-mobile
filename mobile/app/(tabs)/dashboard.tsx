import { useState } from "react";
import {
  ScrollView,
  Text,
  View,
  RefreshControl,
  Pressable,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, queryClient } from "../../lib/api";
import { Summary } from "../../lib/types";
import { c, ui, number, localDay } from "../../lib/theme";
import { useAuthStore } from "../../store/authStore";
import AppHeader from "../../components/AppHeader";
import { State } from "../../components/UI";
import GroupedStatistics from "../../components/GroupedStatistics";
import OverviewPeriod from "../../components/OverviewPeriod";
function Metric({
  label,
  value,
  unit,
  icon,
}: {
  label: string;
  value: string;
  unit?: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
}) {
  return (
    <View
      style={[ui.card, { flexGrow: 1, flexBasis: 140, padding: 16, gap: 12 }]}
    >
      <Ionicons name={icon} size={23} color={c.blue} />
      <Text style={{ fontSize: 24, fontWeight: "800", color: c.text }}>
        {value} <Text style={ui.muted}>{unit}</Text>
      </Text>
      <Text style={ui.muted}>{label}</Text>
    </View>
  );
}
export default function Dashboard() {
  const user = useAuthStore((s) => s.user)!,
    router = useRouter(),
    admin = user.role === "admin";
  const [range, setRange] = useState(() => ({
    startDate: localDay(),
    endDate: localDay(),
  }));
  const { startDate, endDate } = range;
  const q = useQuery({
    queryKey: ["summary", user.role, user.id, startDate, endDate],
    queryFn: () =>
      api<Summary>("/reports?startDate=" + startDate + "&endDate=" + endDate),
  });
  const data = q.data;
  const days = (data?.trend || []).map((row) => ({
    day: String(row.day).slice(0, 10),
    weight: Number(row.weight),
  }));
  const max = Math.max(1, ...days.map((d) => d.weight));
  return (
    <View style={ui.screen}>
      <AppHeader />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            tintColor={c.blue}
            refreshing={q.isRefetching}
            onRefresh={() =>
              void Promise.all([
                q.refetch(),
                queryClient.invalidateQueries({ queryKey: ["reportGroups"] }),
              ])
            }
          />
        }
        contentContainerStyle={ui.content}
      >
        <View style={{ gap: 6 }}>
          <Text style={ui.muted}>
            {new Date().toLocaleDateString("vi-VN", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </Text>
          <Text style={ui.title}>
            {admin
              ? "Tổng quan hệ thống"
              : user.stationName?.trim() || "Tổng quan"}
          </Text>
        </View>
        <OverviewPeriod value={range} onChange={setRange} />
        <State
          loading={q.isPending}
          error={q.error}
          onRetry={() => void q.refetch()}
        />
        {data ? (
          <>
            <View
              style={[
                ui.card,
                {
                  backgroundColor: c.navy,
                  borderColor: c.navy,
                  padding: 24,
                  gap: 14,
                },
              ]}
            >
              <View style={[ui.row, { justifyContent: "space-between" }]}>
                <Text style={{ fontSize: 14, color: "#DBEEDC" }}>
                  Doanh thu
                </Text>
                <View
                  style={{
                    padding: 10,
                    borderRadius: 14,
                    backgroundColor: c.yellow,
                  }}
                >
                  <Ionicons name="wallet-outline" size={22} color={c.navy} />
                </View>
              </View>
              <Text
                accessibilityLabel="Tổng doanh thu"
                adjustsFontSizeToFit
                numberOfLines={1}
                style={{ fontSize: 36, fontWeight: "800", color: "white" }}
              >
                {number(data.summary.revenue)}{" "}
                <Text style={{ fontSize: 18, color: "#DBEEDC" }}>đ</Text>
              </Text>
              <Text style={{ fontSize: 13, color: "#DBEEDC" }}>
                {number(data.summary.totalRecords)} lượt cân
              </Text>
            </View>
            <View style={ui.wrap}>
              <Metric
                label="Khối lượng"
                value={number(Number(data.summary.totalNet) / 1000)}
                unit="tấn"
                icon="scale-outline"
              />
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
              <Metric
                label="Chờ cân lần 2"
                value={number(data.summary.pending)}
                icon="time-outline"
              />
            </View>
            {admin && data.system ? (
              <View
                style={[ui.card, ui.row, { justifyContent: "space-around" }]}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Quản lý trạm cân"
                  onPress={() => router.push("/(tabs)/stations")}
                  style={{ gap: 5, alignItems: "center" }}
                >
                  <Text style={ui.heading}>{number(data.system.stations)}</Text>
                  <Text style={ui.muted}>Trạm cân</Text>
                </Pressable>
                <View
                  style={{ width: 1, height: 32, backgroundColor: c.line }}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Quản lý tài khoản"
                  onPress={() => router.push("/(tabs)/accounts")}
                  style={{ gap: 5, alignItems: "center" }}
                >
                  <Text style={ui.heading}>{number(data.system.accounts)}</Text>
                  <Text style={ui.muted}>Tài khoản</Text>
                </Pressable>
              </View>
            ) : null}
            <View style={ui.card}>
              <Text style={ui.heading}>Khối lượng theo kỳ</Text>
              <Text style={ui.muted}>
                {data.trendUnit === "year"
                  ? "Theo năm"
                  : data.trendUnit === "month"
                    ? "Theo tháng"
                    : "Theo ngày"}
              </Text>
              {days.length === 0 ? (
                <Text style={ui.muted}>
                  Chưa có dữ liệu trong khoảng đã chọn.
                </Text>
              ) : (
                <ScrollView
                  horizontal
                  contentContainerStyle={{
                    flexGrow: 1,
                    gap: 8,
                    alignItems: "flex-end",
                  }}
                >
                  <View
                    style={{
                      height: 145,
                      flexDirection: "row",
                      gap: 8,
                      alignItems: "flex-end",
                      paddingTop: 16,
                    }}
                  >
                    {days.map((d, i) => (
                      <View
                        key={d.day}
                        style={{ width: 62, alignItems: "center", gap: 8 }}
                      >
                        <Text
                          numberOfLines={1}
                          style={{ fontSize: 9, color: c.muted }}
                        >
                          {number(d.weight)}
                        </Text>
                        <View
                          accessibilityLabel={
                            d.day + ": " + number(d.weight) + " kg"
                          }
                          style={{
                            width: "65%",
                            maxWidth: 50,
                            height: Math.max(4, (d.weight / max) * 85),
                            backgroundColor:
                              i === days.length - 1 ? c.blue : "#BDDCC2",
                            borderRadius: 6,
                          }}
                        />
                        <Text style={{ fontSize: 10, color: c.muted }}>
                          {data.trendUnit === "year"
                            ? d.day.slice(0, 4)
                            : data.trendUnit === "month"
                              ? d.day.slice(5, 7) + "/" + d.day.slice(0, 4)
                              : d.day.slice(8) + "/" + d.day.slice(5, 7)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              )}
            </View>
          </>
        ) : null}
        <GroupedStatistics startDate={startDate} endDate={endDate} />
      </ScrollView>
    </View>
  );
}
