import { useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  DurianHeader,
  LoadState,
  Metric,
  Status,
  ds,
  palette,
} from "../../../components/DurianUI";
import { kg, money, useDurianQuery, type Overview } from "../../../lib/durian";
import { useAuthStore } from "../../../store/authStore";
import { Segments } from "../../../components/BrowseUI";
import { c, ui } from "../../../lib/theme";

export default function DurianOverview() {
  const router = useRouter();
  const canRead = useAuthStore((state) =>
    state.user?.permissions?.includes("durian:read"),
  );
  const [activeOnly, setActiveOnly] = useState(false);
  const query = useDurianQuery<Overview>("/durian/overview");
  const data = query.data;
  return (
    <View style={ds.page}>
      <DurianHeader
        title="Cân sầu riêng"
        updatedAt={query.dataUpdatedAt}
        onRefresh={canRead ? () => void query.refetch() : undefined}
      />
      <FlatList
        contentContainerStyle={ds.content}
        data={data?.gates.filter((gate) => !activeOnly || gate.ticket) ?? []}
        keyExtractor={(gate) => gate.id}
        refreshing={query.isRefetching}
        onRefresh={canRead ? () => void query.refetch() : undefined}
        ListHeaderComponent={
          <View style={{ gap: 14 }}>
            {!canRead ? (
              <Text style={ds.warning}>
                Tài khoản chưa được cấp quyền xem dữ liệu cân sầu riêng.
              </Text>
            ) : null}
            <LoadState
              loading={query.isLoading}
              error={query.error}
              cached={!!data}
              retry={() => void query.refetch()}
            />
            {data ? (
              <>
                <Metric
                  weight={data.kg}
                  label="Khối lượng hôm nay"
                  scene="durian"
                >
                  <View style={ds.between}>
                    <Text style={{ color: palette.white, fontWeight: "700" }}>
                      {data.trips} chuyến đã kết thúc
                    </Text>
                    <Text style={{ color: "#C8EFE0", fontWeight: "700" }}>
                      {data.activeGates} cửa đang cân
                    </Text>
                  </View>
                </Metric>
                {data.purchases ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Xem báo cáo mua hàng hôm nay"
                    onPress={() =>
                      router.navigate({
                        pathname: "/durian/reports",
                        params: { today: String(Date.now()) },
                      })
                    }
                    style={({ pressed }) => [
                      ui.card,
                      ui.row,
                      {
                        gap: 12,
                        padding: 13,
                        backgroundColor: pressed ? c.soft : c.white,
                      },
                    ]}
                  >
                    <View style={[ui.iconButton, { backgroundColor: c.soft }]}>
                      <Ionicons
                        name="wallet-outline"
                        size={23}
                        color={c.navy}
                      />
                    </View>
                    <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                      <Text style={ui.muted}>Tiền hàng hôm nay</Text>
                      <Text
                        style={{
                          color: c.navy,
                          fontSize: 23,
                          fontWeight: "800",
                          fontVariant: ["tabular-nums"],
                        }}
                      >
                        {money(data.purchases.amount)}
                      </Text>
                      {data.purchases.missingPrices ? (
                        <Text style={[ui.muted, { color: c.amber }]}>
                          {data.purchases.missingPrices} phiếu chưa đủ đơn giá
                        </Text>
                      ) : null}
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={19}
                      color={c.muted}
                    />
                  </Pressable>
                ) : null}
                <Text style={ds.heading}>Cửa cân</Text>
                {data.gates.length >= 9 ? (
                  <Segments
                    items={[
                      { value: "all", label: "Tất cả" },
                      { value: "active", label: "Đang cân" },
                    ]}
                    value={activeOnly ? "active" : "all"}
                    onChange={(value) => setActiveOnly(value === "active")}
                  />
                ) : null}
              </>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          data ? (
            <Text style={ds.muted}>
              {activeOnly
                ? "Hiện không có cửa đang cân."
                : "Chưa có cửa cân hoạt động."}
            </Text>
          ) : null
        }
        renderItem={({ item }) => {
          const ticket = item.ticket;
          const contents = (
            <>
              <View style={ds.between}>
                <Text style={ds.heading}>{item.name}</Text>
                <Status running={!!ticket}>
                  {ticket ? "Đang cân" : "Sẵn sàng"}
                </Status>
              </View>
              {ticket ? (
                <>
                  <View style={ds.between}>
                    <Text style={ds.body}>
                      {ticket.plate || "Chưa có biển số"} · Phiếu{" "}
                      {ticket.number}
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={palette.primary}
                    />
                  </View>
                  <Text style={ds.weight}>{kg(ticket.kg)} kg</Text>
                  <View style={ds.row}>
                    {item.grades.map((grade) => (
                      <Text
                        key={grade.code}
                        style={[
                          ds.muted,
                          {
                            padding: 7,
                            borderRadius: 8,
                            backgroundColor: palette.background,
                          },
                        ]}
                      >
                        {grade.classification} · {kg(grade.kg)} kg
                      </Text>
                    ))}
                  </View>
                </>
              ) : null}
            </>
          );
          return ticket ? (
            <Pressable
              accessibilityRole="button"
              style={ds.card}
              onPress={() =>
                router.push({
                  pathname: "/durian/ticket/[id]",
                  params: { id: ticket.id },
                })
              }
            >
              {contents}
            </Pressable>
          ) : (
            <View style={ds.card}>{contents}</View>
          );
        }}
      />
    </View>
  );
}
