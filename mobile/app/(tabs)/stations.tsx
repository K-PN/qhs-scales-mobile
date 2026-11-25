import { useEffect, useState } from "react";
import { FlatList, Text, View, Switch } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, queryString } from "../../lib/api";
import { Page, Station } from "../../lib/types";
import { c, ui, number } from "../../lib/theme";
import { useAuthStore, userScope, type DatabaseSource } from "../../store/authStore";
import AppHeader from "../../components/AppHeader";
import { SearchBar, Segments } from "../../components/BrowseUI";
import {
  AdminActions,
  AdminAdd,
  AdminIdentity,
  refreshAdminData,
} from "../../components/AdminUI";
import { Badge, Button, Field, Pager, Sheet, State } from "../../components/UI";
const databaseLabel = (source: DatabaseSource) => source === "db1" ? "Database 1" : "Database 2";
const scaleTypes = [
  { value: "truck", label: "Cân xe tải" },
  { value: "durian", label: "Cân sầu riêng" },
] as const;

function StationForm({
  station,
  routingAvailable,
  onClose,
}: {
  station: Station | null;
  routingAvailable: boolean;
  onClose: () => void;
}) {
  const source = useAuthStore((state) => state.adminSource);
  const sources = useAuthStore((state) => state.user?.databaseSources) ?? [source];
  const [name, setName] = useState(station?.name || ""),
    [address, setAddress] = useState(station?.address || ""),
    [phone, setPhone] = useState(station?.phonenumber || ""),
    [active, setActive] = useState(station?.enabled ?? true);
  const [stationType, setStationType] = useState(station?.stationType ?? "truck");
  const [dataSource, setDataSource] = useState(station?.dataSource ?? source);
  const [target, setTarget] = useState(station?.dataSource !== source ? String(station?.dataStationId ?? "") : "");
  const crossSource = dataSource !== source;
  const validTarget = /^[1-9]\d*$/.test(target) && Number.isSafeInteger(Number(target));
  const targetStation = useQuery({
    queryKey: ["stations", "data-target", dataSource, target],
    queryFn: () => api<Station>("/admin/stations/" + target + "?" + queryString({ source: dataSource })),
    enabled: routingAvailable && crossSource && validTarget,
  });
  const changedRouting = !station || stationType !== station.stationType ||
    dataSource !== station.dataSource || (crossSource && Number(target) !== station.dataStationId);
  const mutation = useMutation({
    mutationFn: () =>
      api("/admin/stations" + (station ? "/" + station.id : "") + "?" + queryString({ source }), {
        method: station ? "PATCH" : "POST",
        body: JSON.stringify({
          name,
          address,
          phonenumber: phone,
          enabled: active,
          ...(station ? { version: station.version } : {}),
          ...(routingAvailable && changedRouting ? {
            data: {
              stationType,
              dataSource,
              ...(crossSource ? { dataStationId: Number(target) } : {}),
            },
          } : {}),
        }),
      }),
    onSuccess: async () => {
      await refreshAdminData();
      onClose();
    },
  });
  return (
    <Sheet
      visible
      title={station ? "Cập nhật trạm #" + station.id : "Thêm trạm cân"}
      onClose={onClose}
    >
      <Field label="Tên trạm cân" value={name} onChange={setName} />
      <Field label="Địa chỉ" value={address} onChange={setAddress} />
      <Field label="Điện thoại" value={phone} onChange={setPhone} />
      {routingAvailable ? (
        <View style={{ gap: 10 }}>
          <View style={{ gap: 5 }}>
            <Text style={ui.body}>Loại trạm</Text>
            <Segments items={scaleTypes} value={stationType} onChange={setStationType} />
          </View>
          {sources.length > 1 ? (
            <View style={{ gap: 5 }}>
              <Text style={ui.body}>Nguồn dữ liệu cân</Text>
              <Segments value={dataSource} onChange={setDataSource}
                items={sources.map((value) => ({ value, label: databaseLabel(value) }))} />
            </View>
          ) : null}
          {crossSource ? (
            <>
              <Field label="Mã trạm ở nguồn dữ liệu" value={target} onChange={setTarget} numeric />
              {validTarget ? (
                <State loading={targetStation.isPending} error={targetStation.error} />
              ) : null}
              {targetStation.data ? (
                <Text style={targetStation.data.enabled ? ui.muted : ui.error}>
                  {targetStation.data.name}{targetStation.data.enabled ? "" : " · Đã khóa"}
                </Text>
              ) : null}
            </>
          ) : null}
        </View>
      ) : (
        <Text style={ui.muted}>Cần cài đặt cấu hình nguồn cho {databaseLabel(source)} để đổi loại trạm hoặc nguồn dữ liệu.</Text>
      )}
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
        disabled={!name.trim() || (routingAvailable && changedRouting && crossSource && (!validTarget || !targetStation.data?.enabled))}
        onPress={() => mutation.mutate()}
      />
    </Sheet>
  );
}
export default function Stations() {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [edit, setEdit] = useState<Station | null | undefined>(undefined);
  const [menu, setMenu] = useState<Station | null>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(text.trim());
      setPage(1);
    }, 280);
    return () => clearTimeout(timer);
  }, [text]);
  const query = useQuery({
    queryKey: ["stations", ...userScope(user), search, page],
    queryFn: () =>
      api<Page<Station> & { routingAvailable?: boolean }>("/admin/stations?" + queryString({ q: search, page })),
    enabled: user?.role === "admin",
  });
  if (user?.role !== "admin") return <Redirect href="/(tabs)/dashboard" />;
  return (
    <View style={ui.screen}>
      <AppHeader
        title="Quản lý trạm cân"
        onRefresh={() => void query.refetch()}
      />
      <View style={[ui.content, { paddingVertical: 10, gap: 7 }]}>
        <View style={[ui.row, { gap: 8 }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <SearchBar label="Tìm trạm cân" value={text} onChange={setText} />
          </View>
          <AdminAdd
            title="Thêm trạm"
            onPress={() => {
              setNotice("");
              setEdit(null);
            }}
          />
        </View>
      </View>
      <FlatList
        data={query.isError ? [] : (query.data?.items ?? [])}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[ui.content, { paddingTop: 0, gap: 8 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshing={query.isRefetching}
        onRefresh={() => void query.refetch()}
        ListHeaderComponent={
          <View style={{ gap: 6 }}>
            {notice ? (
              <Text
                accessibilityRole="alert"
                style={[ui.muted, { color: c.navy }]}
              >
                {notice}
              </Text>
            ) : null}
            <State
              loading={query.isPending}
              error={query.error}
              onRetry={() => void query.refetch()}
            />
            {query.data && query.data.total > 0 ? (
              <Text style={ui.muted}>{number(query.data.total)} trạm cân</Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          !query.isPending && !query.error ? <State empty /> : null
        }
        renderItem={({ item }) => (
          <View style={ui.card}>
            <AdminIdentity
              icon="business-outline"
              title={item.name}
              subtitle={
                "Mã trạm #" +
                item.id +
                (item.phonenumber ? " · " + item.phonenumber : "")
              }
              onActions={() => {
                setMenu(item);
                setNotice("");
              }}
            />
            {item.address ? <Text style={ui.muted}>{item.address}</Text> : null}
            <View style={ui.wrap}>
              <Badge
                label={
                  item.stationType === "durian" ? "Cân sầu riêng" : "Cân xe tải"
                }
              />
              {item.dataSource && user.databaseSources && user.databaseSources.length > 1 ? (
                <Badge label={databaseLabel(item.dataSource) + " · #" + item.dataStationId} />
              ) : null}
              <Badge
                label={item.enabled ? "Đang hoạt động" : "Đã khóa"}
                tone={item.enabled ? "green" : "red"}
              />
            </View>
          </View>
        )}
        ListFooterComponent={
          query.data && query.data.total > query.data.limit ? (
            <Pager
              page={page}
              total={query.data.total}
              limit={query.data.limit}
              onChange={setPage}
            />
          ) : null
        }
      />
      {menu ? (
        <AdminActions
          label={menu.name}
          noun="trạm cân"
          path={"/admin/stations/" + menu.id}
          version={menu.version}
          onClose={() => setMenu(null)}
          onArchived={() => {
            setPage(1);
            setMenu(null);
            setNotice("Đã xóa trạm cân.");
          }}
          onEdit={() => {
            setEdit(menu);
            setMenu(null);
          }}
          secondary={{
            label: "Tài khoản của trạm",
            icon: "people-outline",
            action: () => {
              router.push({
                pathname: "/(tabs)/accounts",
                params: { stationId: String(menu.id), stationName: menu.name },
              });
              setMenu(null);
            },
          }}
        />
      ) : null}
      {edit !== undefined ? (
        <StationForm station={edit} routingAvailable={query.data?.routingAvailable === true} onClose={() => setEdit(undefined)} />
      ) : null}
    </View>
  );
}
