import { useState } from "react";
import { FlatList, Text, View, Pressable, Switch } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { api, queryString, queryClient } from "../../lib/api";
import { Page, Station } from "../../lib/types";
import { c, ui, number } from "../../lib/theme";
import { useAuthStore } from "../../store/authStore";
import AppHeader from "../../components/AppHeader";
import { Badge, Button, Field, Pager, Sheet, State } from "../../components/UI";
function StationForm({
  station,
  onClose,
}: {
  station: Station | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(station?.name || ""),
    [address, setAddress] = useState(station?.address || ""),
    [phone, setPhone] = useState(station?.phonenumber || ""),
    [active, setActive] = useState(station?.enabled ?? true);
  const mutation = useMutation({
    mutationFn: () =>
      api("/admin/stations" + (station ? "/" + station.id : ""), {
        method: station ? "PATCH" : "POST",
        body: JSON.stringify({
          name,
          address,
          phonenumber: phone,
          enabled: active,
          ...(station ? { version: station.version } : {}),
        }),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["stations"] }),
        queryClient.invalidateQueries({ queryKey: ["summary"] }),
      ]);
      onClose();
    },
  });
  return (
    <Sheet
      visible
      title={station ? "Cập nhật trạm #" + station.id : "Thêm trạm cân"}
      onClose={onClose}
    >
      <Field label="TÊN TRẠM CÂN" value={name} onChange={setName} />
      <Field label="ĐỊA CHỈ" value={address} onChange={setAddress} />
      <Field label="ĐIỆN THOẠI" value={phone} onChange={setPhone} />
      <View style={[ui.card, ui.row, { justifyContent: "space-between" }]}>
        <Text style={ui.body}>Trạm đang hoạt động</Text>
        <Switch
          accessibilityLabel="Trạm đang hoạt động"
          value={active}
          onValueChange={setActive}
          trackColor={{ true: c.blue }}
        />
      </View>
      {mutation.error ? (
        <Text style={ui.error}>{mutation.error.message}</Text>
      ) : null}
      <Button
        title={station ? "Lưu thay đổi" : "Tạo trạm cân"}
        busy={mutation.isPending}
        disabled={!name.trim()}
        onPress={() => mutation.mutate()}
      />
    </Sheet>
  );
}
export default function Stations() {
  const user = useAuthStore((s) => s.user),
    router = useRouter();
  const [q, setQ] = useState(""),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [edit, setEdit] = useState<Station | null | undefined>(undefined);
  const query = useQuery({
    queryKey: ["stations", search, page],
    queryFn: () =>
      api<Page<Station>>("/admin/stations?" + queryString({ q: search, page })),
    enabled: user?.role === "admin",
  });
  if (user?.role !== "admin") return <Redirect href="/(tabs)/dashboard" />;
  return (
    <View style={ui.screen}>
      <AppHeader />
      <FlatList
        data={query.isError ? [] : query.data?.items || []}
        keyExtractor={(s) => String(s.id)}
        contentContainerStyle={ui.content}
        keyboardShouldPersistTaps="handled"
        refreshing={query.isRefetching}
        onRefresh={() => void query.refetch()}
        ListHeaderComponent={
          <View style={{ gap: 18, marginBottom: 18 }}>
            <View
              style={[
                ui.row,
                { justifyContent: "space-between", flexWrap: "wrap" },
              ]}
            >
              <View>
                <Text style={ui.title}>Trạm cân</Text>
                <Text style={ui.muted}>
                  {number(query.data?.total)} trạm trong hệ thống
                </Text>
              </View>
              <Button title="+ Thêm trạm" onPress={() => setEdit(null)} />
            </View>
            <View style={ui.card}>
              <Field
                label="TRA CỨU TRẠM"
                value={q}
                onChange={setQ}
                placeholder="Tên trạm hoặc số điện thoại"
              />
              <Button
                secondary
                title="Tìm kiếm"
                onPress={() => {
                  setSearch(q);
                  setPage(1);
                }}
              />
            </View>
            <State
              loading={query.isPending}
              error={query.error}
              onRetry={() => void query.refetch()}
            />
          </View>
        }
        ListEmptyComponent={
          !query.isPending && !query.error ? <State empty /> : null
        }
        renderItem={({ item: s }) => (
          <View style={[ui.card, { marginBottom: 12 }]}>
            <View style={[ui.row, { justifyContent: "space-between" }]}>
              <View
                style={{
                  backgroundColor: "#EAF4EB",
                  padding: 12,
                  borderRadius: 14,
                }}
              >
                <Ionicons name="business-outline" size={24} color={c.blue} />
              </View>
              <Badge
                label={s.enabled ? "Đang hoạt động" : "Đã khóa"}
                tone={s.enabled ? "green" : "red"}
              />
            </View>
            <Text style={ui.heading}>{s.name}</Text>
            <Text style={ui.muted}>
              Mã trạm #{s.id} · {s.phonenumber || "Chưa có điện thoại"}
            </Text>
            <Text style={ui.muted}>{s.address || "Chưa có địa chỉ"}</Text>
            <View style={ui.separator} />
            <View style={ui.wrap}>
              <Button secondary title="Chỉnh sửa" onPress={() => setEdit(s)} />
              <Button
                secondary
                title="Tài khoản trạm"
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/accounts",
                    params: { stationId: String(s.id) },
                  })
                }
              />
            </View>
          </View>
        )}
        ListFooterComponent={
          query.data && !query.error ? (
            <Pager page={page} total={query.data.total} onChange={setPage} />
          ) : null
        }
      />
      {edit !== undefined ? (
        <StationForm station={edit} onClose={() => setEdit(undefined)} />
      ) : null}
    </View>
  );
}
