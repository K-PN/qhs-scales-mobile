import { useRef, useState } from "react";
import { FlatList, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import {
  DurianHeader,
  LoadState,
  Status,
  ds,
} from "../../../components/DurianUI";
import {
  kg,
  money,
  stationTime,
  useDurianQuery,
  type Detail,
} from "../../../lib/durian";
import { useAuthStore } from "../../../store/authStore";
import {
  Segments,
  SpecRows,
  SwipeSections,
} from "../../../components/BrowseUI";
import { c, ui } from "../../../lib/theme";

const sections = [
  { value: "Tổng hợp", label: "Tổng hợp" },
  { value: "Lượt cân", label: "Lượt cân" },
  { value: "Đơn mua hàng", label: "Đơn mua hàng" },
] as const;
type Section = (typeof sections)[number]["value"];
type Line = {
  id: string;
  title: string;
  sub?: string;
  detail?: string;
  kg: number;
  warning?: string;
};

export default function DurianTicketDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const canRead = useAuthStore((state) =>
    state.user?.permissions?.includes("durian:read"),
  );
  const [section, setSection] = useState<Section>("Tổng hợp");
  const list = useRef<FlatList<Line>>(null);
  function switchSection(next: Section) {
    if (next === section) return;
    setSection(next);
    list.current?.scrollToOffset({ offset: 0, animated: false });
  }
  const query = useDurianQuery<Detail>(
    "/durian/tickets/" + encodeURIComponent(id ?? ""),
    !!id,
  );
  const data =
    query.error &&
    "status" in query.error &&
    [403, 404].includes(Number(query.error.status))
      ? undefined
      : query.data;
  const ticket = data?.ticket;
  const rows: Line[] =
    section === "Lượt cân"
      ? (data?.events.map((event) => ({
          id: event.id,
          title: event.classification,
          sub: stationTime(event.at),
          kg: event.kg,
        })) ?? [])
      : (data?.items.map((item) =>
          section === "Đơn mua hàng"
            ? {
                id: item.code,
                title: item.description || "Chưa có diễn giải",
                sub: item.classification,
                kg: item.kg,
                warning:
                  item.unitPrice === null ? "Chưa có đơn giá" : undefined,
                detail:
                  item.unitPrice === null
                    ? undefined
                    : money(item.unitPrice) +
                      "/kg · Thành tiền " +
                      money(item.amount ?? 0),
              }
            : {
                id: item.code,
                title: item.classification,
                sub: item.count + " lượt cân",
                kg: item.kg,
              },
        ) ?? []);
  return (
    <View style={ds.page}>
      <DurianHeader
        title="Chi tiết phiếu"
        back
        updatedAt={query.dataUpdatedAt}
        onRefresh={canRead && id ? () => void query.refetch() : undefined}
      />
      <SwipeSections items={sections} value={section} onChange={switchSection}>
        <FlatList
          ref={list}
          contentContainerStyle={[ds.content, { gap: 8 }]}
          data={rows}
          keyExtractor={(line) => line.id}
          refreshing={query.isRefetching}
          onRefresh={canRead && id ? () => void query.refetch() : undefined}
          ListHeaderComponent={
            <View style={{ gap: 14 }}>
              {!canRead ? (
                <Text style={ds.warning}>
                  Tài khoản chưa được cấp quyền xem phiếu cân.
                </Text>
              ) : null}
              <LoadState
                loading={query.isLoading}
                error={query.error}
                cached={!!data}
                retry={() => void query.refetch()}
              />
              {ticket ? (
                <>
                  <View
                    style={[
                      ds.card,
                      { backgroundColor: c.hero, borderColor: c.navy, gap: 6 },
                    ]}
                  >
                    <View style={ds.between}>
                      <Text
                        style={[ds.heading, { color: c.white, fontSize: 22 }]}
                      >
                        {ticket.plate || "Chưa có biển số"}
                      </Text>
                      <Status running={ticket.status === "running"}>
                        {ticket.status === "running"
                          ? "Đang cân"
                          : "Đã kết thúc"}
                      </Status>
                    </View>
                    <Text style={{ color: c.onHero }}>
                      Phiếu {ticket.number} · {ticket.gateName}
                    </Text>
                    <Text style={[ds.weight, { color: c.white }]}>
                      {kg(ticket.kg)} kg
                    </Text>
                    {ticket.supplier ? (
                      <Text style={{ color: c.onHero }}>{ticket.supplier}</Text>
                    ) : null}
                    <Text style={{ color: c.onHero }}>
                      {ticket.status === "running"
                        ? "Bắt đầu · " + stationTime(ticket.startedAt)
                        : "Kết thúc · " + stationTime(ticket.endedAt)}
                    </Text>
                  </View>
                  <Segments
                    items={sections}
                    value={section}
                    onChange={switchSection}
                  />
                </>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            ticket ? (
              <Text style={ds.muted}>Chưa có lượt cân hợp lệ.</Text>
            ) : null
          }
          ListFooterComponent={
            section === "Đơn mua hàng" && data && data.items.length ? (
              <SpecRows
                items={[
                  ["Tiền hàng", money(data.amount)],
                  ...(data.tax !== 0
                    ? [["Thuế", money(data.tax)] as const]
                    : []),
                  [
                    data.missingPrices ? "Tạm tính" : "Tổng cộng",
                    money(data.total),
                  ],
                ]}
              />
            ) : null
          }
          renderItem={({ item }) => (
            <View style={[ds.card, { padding: 12, gap: 4 }]}>
              <View style={ds.between}>
                <Text style={ds.heading}>{item.title}</Text>
                <Text style={[ui.heading, { color: c.navy }]}>
                  {kg(item.kg)} kg
                </Text>
              </View>
              {item.sub ? <Text style={ds.muted}>{item.sub}</Text> : null}
              {item.detail ? <Text style={ds.body}>{item.detail}</Text> : null}
              {item.warning ? (
                <Text style={ds.warning}>{item.warning}</Text>
              ) : null}
            </View>
          )}
        />
      </SwipeSections>
    </View>
  );
}
