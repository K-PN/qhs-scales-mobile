import { useEffect, useState } from "react";
import { FlatList, Text, View, Switch } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, queryString } from "../../lib/api";
import type { Account, Page, Station } from "../../lib/types";
import { c, ui, number } from "../../lib/theme";
import { useAuthStore, userScope } from "../../store/authStore";
import AppHeader from "../../components/AppHeader";
import { SearchBar } from "../../components/BrowseUI";
import {
  AdminActions,
  AdminAdd,
  AdminIdentity,
  refreshAdminData,
} from "../../components/AdminUI";
import {
  Badge,
  Button,
  Chips,
  Field,
  Pager,
  Sheet,
  State,
} from "../../components/UI";

type SelectedStation = {
  id: number;
  name: string;
  stationType?: Station["stationType"];
};
function StationPicker({
  choose,
  close,
  activeOnly = true,
}: {
  choose: (station: Station) => void;
  close: () => void;
  activeOnly?: boolean;
}) {
  const user = useAuthStore((state) => state.user);
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(text.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [text]);
  const stations = useQuery({
    queryKey: [
      "stations",
      "picker",
      ...userScope(user),
      search,
      page,
      activeOnly,
    ],
    queryFn: () =>
      api<Page<Station>>(
        "/admin/stations?" +
          queryString({
            q: search,
            page,
            limit: 8,
            enabledOnly: activeOnly ? "1" : undefined,
          }),
      ),
  });
  return (
    <>
      <SearchBar
        label="Tìm trạm cân"
        value={text}
        onChange={setText}
        placeholder="Tên trạm hoặc điện thoại"
      />
      <State
        loading={stations.isLoading}
        error={stations.error}
        empty={stations.data?.total === 0}
        onRetry={() => void stations.refetch()}
      />
      {stations.data?.items.map((station) => (
        <Button
          secondary
          key={station.id}
          icon="business-outline"
          title={station.name + " · #" + station.id}
          onPress={() => choose(station)}
        />
      ))}
      {stations.data && stations.data.total > stations.data.limit ? (
        <Pager
          page={page}
          total={stations.data.total}
          limit={stations.data.limit}
          onChange={setPage}
        />
      ) : null}
      <Button secondary title="Hủy chọn" onPress={close} />
    </>
  );
}

function AccountForm({
  account,
  initialStation,
  assign,
  onClose,
  onSaved,
}: {
  account: Account | null;
  initialStation?: string;
  assign?: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const user = useAuthStore((state) => state.user);
  const [username, setUsername] = useState(account?.username ?? "");
  const [station, setStation] = useState<SelectedStation | null>(() =>
    account?.stationId
      ? {
          id: account.stationId,
          name: account.stationName || "Trạm #" + account.stationId,
          stationType: account.stationType,
        }
      : null,
  );
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(account ? String(account.roleId) : "");
  const [active, setActive] = useState(account?.enabled ?? true);
  const [durianRole, setDurianRole] = useState<Account["durianRole"]>(
    account?.durianRole ?? "none",
  );
  const [validation, setValidation] = useState("");
  const [picking, setPicking] = useState(false);
  const roles = useQuery({
    queryKey: ["roles", ...userScope(user)],
    queryFn: () =>
      api<{ items: { id: number; name: string }[] }>("/admin/roles"),
  });
  const preselected = useQuery({
    queryKey: ["stations", "selected", ...userScope(user), initialStation],
    queryFn: () => api<Station>("/admin/stations/" + initialStation),
    enabled: !account && !!initialStation,
  });
  const target = station ?? preselected.data;
  const mutation = useMutation({
    mutationFn: () =>
      api("/admin/accounts" + (account ? "/" + account.id : ""), {
        method: account ? "PATCH" : "POST",
        body: JSON.stringify({
          ...(!assign && (!account || username.trim() !== account.username)
            ? { username: username.trim() }
            : {}),
          ...(!account || target?.id !== account.stationId
            ? { stationId: target?.id }
            : {}),
          roleId: Number(role),
          enabled: active,
          ...(password ? { password } : {}),
          ...(target?.stationType === "durian" ? { durianRole } : {}),
          ...(account ? { version: account.version } : {}),
        }),
      }),
    onSuccess: async () => {
      await refreshAdminData();
      onSaved();
    },
  });
  function submit() {
    setValidation("");
    if (!target) return setValidation("Vui lòng chọn trạm cân.");
    if (
      (!account || username !== account.username) &&
      !/^[A-Za-z0-9_.@-]{1,10}$/.test(username.trim())
    ) {
      return setValidation(
        "Tên đăng nhập gồm 1–10 ký tự không dấu, có thể dùng số và _.@-.",
      );
    }
    if ((!account || password) && !/^[\x20-\x7E]{6,64}$/.test(password)) {
      return setValidation("Mật khẩu từ 6–64 ký tự không dấu.");
    }
    mutation.mutate();
  }
  return (
    <Sheet
      visible
      title={
        picking
          ? "Chọn trạm cân"
          : assign
            ? "Gán trạm và quyền"
            : account
              ? "Chỉnh sửa tài khoản"
              : "Thêm tài khoản"
      }
      onClose={
        mutation.isPending
          ? () => {}
          : picking
            ? () => setPicking(false)
            : onClose
      }
    >
      {picking ? (
        <StationPicker
          close={() => setPicking(false)}
          choose={(next) => {
            if (next.id !== target?.id)
              setDurianRole(
                next.id === account?.stationId
                  ? (account.durianRole ?? "none")
                  : "none",
              );
            setStation(next);
            setPicking(false);
          }}
        />
      ) : (
        <>
          {assign ? (
            <Text style={ui.heading}>{account?.username}</Text>
          ) : (
            <Field
              label="Tên đăng nhập"
              value={username}
              onChange={setUsername}
            />
          )}
          <View style={{ gap: 6 }}>
            <Text style={ui.label}>Trạm cân</Text>
            <Button
              secondary
              icon="business-outline"
              title={target?.name ?? "Chọn trạm cân"}
              onPress={() => setPicking(true)}
            />
          </View>
          <Text style={ui.label}>Vai trò trên phần mềm cân</Text>
          <State
            loading={roles.isPending}
            error={roles.error}
            onRetry={() => void roles.refetch()}
          />
          {roles.data ? (
            <Chips
              items={roles.data.items.map((item) => ({
                value: String(item.id),
                label: item.name,
              }))}
              value={role}
              onChange={setRole}
            />
          ) : null}
          {target?.stationType === "durian" ? (
            <>
              <Text style={ui.label}>Vai trò trên máy cân sầu riêng</Text>
              <Chips
                items={[
                  { value: "none", label: "Mặc định của trạm" },
                  { value: "operator", label: "Vận hành" },
                  { value: "admin", label: "Quản trị trạm" },
                ]}
                value={durianRole ?? "none"}
                onChange={(value) =>
                  setDurianRole(value as Account["durianRole"])
                }
              />
            </>
          ) : null}
          {!assign ? (
            <>
              <Field
                label={account ? "Mật khẩu mới (nếu đổi)" : "Mật khẩu"}
                value={password}
                onChange={setPassword}
                secret
              />
              <View
                style={[ui.card, ui.row, { justifyContent: "space-between" }]}
              >
                <Text style={[ui.body, { flexShrink: 1 }]}>
                  Cho phép đăng nhập
                </Text>
                <Switch
                  accessibilityLabel="Cho phép đăng nhập"
                  value={active}
                  onValueChange={setActive}
                  trackColor={{ true: c.blue }}
                />
              </View>
            </>
          ) : null}
          {validation || mutation.error ? (
            <Text accessibilityRole="alert" style={ui.error}>
              {validation || mutation.error?.message}
            </Text>
          ) : null}
          <Button
            title={account ? "Lưu thay đổi" : "Tạo tài khoản"}
            busy={mutation.isPending}
            disabled={!role || roles.isError}
            onPress={submit}
          />
        </>
      )}
    </Sheet>
  );
}

export default function Accounts() {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const params = useLocalSearchParams<{
    stationId?: string;
    stationName?: string;
  }>();
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [menu, setMenu] = useState<Account | null>(null);
  const [form, setForm] = useState<{
    account: Account | null;
    assign?: boolean;
  } | null>(null);
  const [notice, setNotice] = useState("");
  const [filtering, setFiltering] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(text.trim());
      setPage(1);
    }, 280);
    return () => clearTimeout(timer);
  }, [text]);
  useEffect(() => {
    setPage(1);
  }, [params.stationId]);
  const query = useQuery({
    queryKey: ["accounts", ...userScope(user), search, params.stationId, page],
    queryFn: () =>
      api<Page<Account>>(
        "/admin/accounts?" +
          queryString({ q: search, stationId: params.stationId, page }),
      ),
    enabled: user?.role === "admin",
  });
  if (user?.role !== "admin") return <Redirect href="/(tabs)/dashboard" />;
  function saved(message: string) {
    setMenu(null);
    setForm(null);
    setPage(1);
    setNotice(message);
  }
  return (
    <View style={ui.screen}>
      <AppHeader
        title="Quản lý tài khoản"
        onRefresh={() => void query.refetch()}
      />
      <View style={[ui.content, { paddingVertical: 10, gap: 7 }]}>
        <View style={[ui.row, { gap: 8 }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <SearchBar
              label="Tìm tài khoản"
              value={text}
              onChange={setText}
              filter={() => setFiltering(true)}
              active={!!params.stationId}
              filterLabel="Lọc theo trạm"
            />
          </View>
          <AdminAdd
            title="Thêm tài khoản"
            onPress={() => {
              setNotice("");
              setForm({ account: null });
            }}
          />
        </View>
        {params.stationId ? (
          <View
            style={[
              ui.wrap,
              { gap: 6, alignItems: "center", justifyContent: "space-between" },
            ]}
          >
            <Text style={[ui.muted, { flexShrink: 1 }]}>
              {params.stationName ?? "Trạm #" + params.stationId}
            </Text>
            <Button
              title="Xem mọi trạm"
              secondary
              onPress={() => router.replace("/(tabs)/accounts")}
            />
          </View>
        ) : null}
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
              <Text style={ui.muted}>{number(query.data.total)} tài khoản</Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          !query.isPending && !query.error ? <State empty /> : null
        }
        renderItem={({ item }) => (
          <View style={ui.card}>
            <AdminIdentity
              icon="person-outline"
              title={item.username}
              subtitle={item.stationName || "Trạm #" + item.stationId}
              onActions={() => {
                setNotice("");
                setMenu(item);
              }}
            />
            <View style={ui.wrap}>
              {item.roleName ? <Badge label={item.roleName} /> : null}
              <Badge
                label={
                  !item.enabled
                    ? "Đã khóa"
                    : item.stationEnabled === false
                      ? "Trạm đã khóa"
                      : "Đang mở"
                }
                tone={
                  !item.enabled || item.stationEnabled === false
                    ? "red"
                    : "green"
                }
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
          label={menu.username}
          noun="tài khoản"
          path={"/admin/accounts/" + menu.id}
          version={menu.version}
          onClose={() => setMenu(null)}
          onArchived={() => saved("Đã xóa tài khoản.")}
          onEdit={() => {
            setForm({ account: menu });
            setMenu(null);
          }}
          secondary={{
            label: "Gán trạm và quyền",
            icon: "options-outline",
            action: () => {
              setForm({ account: menu, assign: true });
              setMenu(null);
            },
          }}
        />
      ) : null}
      {form ? (
        <AccountForm
          account={form.account}
          initialStation={params.stationId}
          assign={form.assign}
          onClose={() => setForm(null)}
          onSaved={() => saved("Đã lưu tài khoản.")}
        />
      ) : null}
      {filtering ? (
        <Sheet
          visible
          title="Lọc theo trạm"
          onClose={() => setFiltering(false)}
        >
          <StationPicker
            activeOnly={false}
            close={() => setFiltering(false)}
            choose={(station) => {
              setPage(1);
              router.setParams({
                stationId: String(station.id),
                stationName: station.name,
              });
              setFiltering(false);
            }}
          />
        </Sheet>
      ) : null}
    </View>
  );
}
