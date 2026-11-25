import { useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  DurianHeader,
  LoadState,
  Metric,
  PeriodPicker,
  ds,
  palette,
  type Period,
} from "../../../components/DurianUI";
import { queryString } from "../../../lib/api";
import {
  kg,
  money,
  stationToday,
  useDurianQuery,
  type GroupBy,
  type Report,
} from "../../../lib/durian";
import { useAuthStore } from "../../../store/authStore";
import { FilterControl } from "../../../components/BrowseUI";
import { Chips, Sheet } from "../../../components/UI";

const groups: { key: GroupBy; label: string }[] = [
  { key: "ticket", label: "Chuyến xe" },
  { key: "gate", label: "Cửa cân" },
  { key: "grade", label: "Phân loại" },
  { key: "supplier", label: "Nhà cung cấp" },
];

export default function DurianReports() {
  const { today } = useLocalSearchParams<{ today?: string }>();
  return <ReportContent key={today ?? "reports"} />;
}

function ReportContent() {
  const router = useRouter();
  const canRead = useAuthStore((state) =>
    state.user?.permissions?.includes("durian:read"),
  );
  const [period, setPeriod] = useState<Period>(() => ({
    startDate: stationToday(),
    endDate: stationToday(),
  }));
  const [groupBy, setGroupBy] = useState<GroupBy>("ticket");
  const [groupOpen, setGroupOpen] = useState(false);
  const query = useDurianQuery<Report>(
    "/durian/reports?" + queryString({ ...period, groupBy }),
  );
  const report = query.data;
  const groupLabel =
    groups.find(({ key }) => key === groupBy)?.label ?? groups[0].label;
  return (
    <View style={ds.page}>
      <DurianHeader
        title="Báo cáo"
        updatedAt={query.dataUpdatedAt}
        onRefresh={canRead ? () => void query.refetch() : undefined}
      />
      <FlatList
        contentContainerStyle={ds.content}
        data={report?.groups ?? []}
        refreshing={query.isRefetching}
        onRefresh={canRead ? () => void query.refetch() : undefined}
        keyExtractor={(group) => group.key}
        ListHeaderComponent={
          <View style={{ gap: 14 }}>
            {!canRead ? (
              <Text style={ds.warning}>
                Tài khoản chưa được cấp quyền xem báo cáo.
              </Text>
            ) : (
              <>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <PeriodPicker value={period} onChange={setPeriod} />
                  <FilterControl
                    label="Nhóm báo cáo"
                    value={groupLabel}
                    icon="layers-outline"
                    onPress={() => setGroupOpen(true)}
                  />
                </View>
                <LoadState
                  loading={query.isLoading}
                  error={query.error}
                  cached={!!report}
                  retry={() => void query.refetch()}
                />
                {report ? (
                  <Metric weight={report.kg}>
                    <View style={ds.between}>
                      <Text style={{ color: palette.white, fontWeight: "700" }}>
                        {report.trips} chuyến đã kết thúc
                      </Text>
                      <Text style={{ color: "#C8EFE0", fontWeight: "700" }}>
                        {money(report.amount)} tiền hàng
                      </Text>
                    </View>
                  </Metric>
                ) : null}
              </>
            )}
          </View>
        }
        ListEmptyComponent={
          report ? (
            <Text style={ds.muted}>
              Không có chuyến đã kết thúc trong kỳ này.
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            style={ds.card}
            onPress={() =>
              router.push({
                pathname: "/durian/tickets",
                params: {
                  ...period,
                  groupBy,
                  groupKey: item.key,
                  label: item.label,
                },
              })
            }
          >
            <View style={ds.between}>
              <Text style={ds.heading}>{item.label || "Chưa có tên cửa"}</Text>
              <Ionicons
                name="chevron-forward"
                color={palette.primary}
                size={20}
              />
            </View>
            <View style={ds.between}>
              <Text style={ds.muted}>
                {item.trips} chuyến · {money(item.amount)}
              </Text>
              <Text style={[ds.heading, { color: palette.dark }]}>
                {kg(item.kg)} kg
              </Text>
            </View>
          </Pressable>
        )}
      />
      <Sheet
        visible={groupOpen}
        title="Nhóm báo cáo"
        onClose={() => setGroupOpen(false)}
      >
        <Chips
          items={groups.map(({ key, label }) => ({ value: key, label }))}
          value={groupBy}
          onChange={(value) => {
            setGroupBy(value as GroupBy);
            setGroupOpen(false);
          }}
        />
      </Sheet>
    </View>
  );
}
