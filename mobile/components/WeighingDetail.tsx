import { useState } from "react";
import { Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api, queryString } from "../lib/api";
import type { Weighing } from "../lib/types";
import { c, ui, number, dateTime } from "../lib/theme";
import { useAuthStore, userScope } from "../store/authStore";
import { Badge, Sheet, State } from "./UI";
import { Segments, SpecRows, SwipeSections } from "./BrowseUI";

const sections = [
  { value: "weights", label: "Khối lượng" },
  { value: "info", label: "Thông tin" },
] as const;
export default function WeighingDetail({
  id,
  stationId,
  onClose,
}: {
  id: number;
  stationId?: string;
  onClose: () => void;
}) {
  const user = useAuthStore((s) => s.user);
  const [section, setSection] = useState<"weights" | "info">("weights");
  const query = useQuery({
    queryKey: ["weighing", ...userScope(user), id, stationId],
    queryFn: () => api<{ item: Weighing }>("/weighings/" + id + (stationId ? "?" + queryString({ stationId }) : "")),
  });
  const w = query.data?.item;
  return (
    <Sheet visible title="Chi tiết phiếu cân" onClose={onClose}>
      <State
        loading={query.isPending}
        error={query.error}
        onRetry={() => void query.refetch()}
      />
      {w ? (
        <>
          <View
            style={[
              ui.card,
              { backgroundColor: c.hero, borderColor: c.navy, gap: 6 },
            ]}
          >
            <View
              style={[
                ui.wrap,
                {
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 6,
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 22,
                  flexShrink: 1,
                  fontWeight: "800",
                  color: c.white,
                }}
              >
                {w.truct_no || "Chưa có biển số"}
              </Text>
              <Badge
                label={w.weight_2 === null ? "Chờ lần 2" : "Đã cân"}
                tone={w.weight_2 === null ? "amber" : "green"}
              />
            </View>
            <Text style={{ color: c.onHero }}>Phiếu {w.formcode}</Text>
            <Text
              accessibilityLabel="Khối lượng hàng"
              style={{
                color: c.white,
                fontSize: 32,
                fontWeight: "800",
                fontVariant: ["tabular-nums"],
              }}
            >
              {w.net_weight === null ? "—" : number(w.net_weight) + " kg"}
            </Text>
          </View>
          <SwipeSections items={sections} value={section} onChange={setSection}>
            <Segments items={sections} value={section} onChange={setSection} />
            {section === "weights" ? (
              <SpecRows
                items={[
                  ["Cân lần 1", number(w.weight_1) + " kg"],
                  [
                    "Cân lần 2",
                    w.weight_2 === null ? "—" : number(w.weight_2) + " kg",
                  ],
                  ["Thành tiền", number(w.price_total) + " đ"],
                ]}
              />
            ) : (
              <SpecRows
                items={[
                  ["Trạm cân", w.station_name?.trim() || "—"],
                  ["Khách hàng", w.customer_name || "—"],
                  ["Hàng hóa", w.items_name || "—"],
                  ["Người cân", w.creator_name || "—"],
                  ["Giờ vào", dateTime(w.date_in)],
                  ["Giờ ra", dateTime(w.date_out)],
                  ...(w.notes ? [["Ghi chú", w.notes] as const] : []),
                ]}
              />
            )}
          </SwipeSections>
        </>
      ) : null}
    </Sheet>
  );
}
