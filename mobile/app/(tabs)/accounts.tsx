import { useEffect, useState } from "react";
import { FlatList, Text, View, Switch } from "react-native";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, queryClient, queryString } from "../../lib/api";
import { Account, Page } from "../../lib/types";
import { c, ui, number } from "../../lib/theme";
import { useAuthStore } from "../../store/authStore";
import AppHeader from "../../components/AppHeader";
import {
  Badge,
  Button,
  Chips,
  Field,
  Pager,
  Sheet,
  State,
} from "../../components/UI";
function AccountForm({
  account,
  stationId,
  onClose,
}: {
  account: Account | null;
  stationId: string;
  onClose: () => void;
}) {
  const [username, setUsername] = useState(account?.username || ""),
    [station, setStation] = useState(
      String(account?.stationId || stationId || ""),
    ),
    [password, setPassword] = useState(""),
    [role, setRole] = useState(account ? String(account.roleId) : ""),
    [active, setActive] = useState(account?.enabled ?? true),
    [validation, setValidation] = useState("");
  const roles = useQuery({
    queryKey: ["roles"],
    queryFn: () =>
      api<{ items: { id: number; name: string }[] }>("/admin/roles"),
  });
  const mutation = useMutation({
    mutationFn: () =>
      api("/admin/accounts" + (account ? "/" + account.id : ""), {
        method: account ? "PATCH" : "POST",
        body: JSON.stringify({
          roleId: Number(role),
          enabled: active,
          ...(password ? { password } : {}),
          ...(account
            ? { version: account.version }
            : { username, stationId: Number(station) }),
        }),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["accounts"] }),
        queryClient.invalidateQueries({ queryKey: ["summary"] }),
      ]);
      onClose();
    },
  });
  function submit() {
    setValidation("");
    if (
      !account &&
      (!/^[A-Za-z0-9_.@-]{1,10}$/.test(username) || !/^[1-9]\d*$/.test(station))
    ) {
      setValidation("Kiểm tra tên tài khoản và mã trạm.");
      return;
    }
    if ((!account || password) && !/^[\x20-\x7E]{6,64}$/.test(password)) {
      setValidation("Mật khẩu từ 6–64 ký tự không dấu.");
      return;
    }
    mutation.mutate();
  }
  return (
    <Sheet
      visible
      title={account ? "Tài khoản " + account.username : "Tạo tài khoản trạm"}
      onClose={onClose}
    >
      {account ? (
        <Text style={ui.heading}>{account.username}</Text>
      ) : (
        <>
          <Field
            label="MÃ TRẠM CÂN"
            numeric
            value={station}
            onChange={setStation}
          />
          <Field
            label="TÊN ĐĂNG NHẬP · TỐI ĐA 10 KÝ TỰ"
            value={username}
            onChange={setUsername}
          />
        </>
      )}
      <Field
        label={account ? "Mật khẩu mới" : "MẬT KHẨU"}
        value={password}
        onChange={setPassword}
        secret
      />
      <Text style={ui.label}>Vai trò</Text>
      <State
        loading={roles.isPending}
        error={roles.error}
        onRetry={() => void roles.refetch()}
      />
      {roles.data ? (
        <Chips
          items={roles.data.items.map((r) => ({
            value: String(r.id),
            label: r.name,
          }))}
          value={role}
          onChange={setRole}
        />
      ) : null}
      <View style={[ui.card, ui.row, { justifyContent: "space-between" }]}>
        <Text style={ui.body}>Cho phép đăng nhập</Text>
        <Switch
          accessibilityLabel="Cho phép đăng nhập"
          value={active}
          onValueChange={setActive}
          trackColor={{ true: c.blue }}
        />
      </View>
      {validation || mutation.error ? (
        <Text style={ui.error}>{validation || mutation.error?.message}</Text>
      ) : null}
      <Button
        title={account ? "Lưu thay đổi" : "Tạo tài khoản"}
        busy={mutation.isPending}
        disabled={!role || roles.isError}
        onPress={submit}
      />
    </Sheet>
  );
}

export default function Accounts() {
  const user = useAuthStore((s) => s.user),
    params = useLocalSearchParams<{ stationId?: string }>();
  const [q, setQ] = useState(""),
    [station, setStation] = useState(params.stationId || ""),
    [filter, setFilter] = useState({
      q: "",
      stationId: params.stationId || "",
    }),
    [page, setPage] = useState(1),
    [edit, setEdit] = useState<Account | null | undefined>(undefined),
    [validation, setValidation] = useState("");
  useEffect(() => {
    setStation(params.stationId || "");
    setFilter({ q: "", stationId: params.stationId || "" });
    setQ("");
    setPage(1);
  }, [params.stationId]);
  const query = useQuery({
    queryKey: ["accounts", filter, page],
    queryFn: () =>
      api<Page<Account>>("/admin/accounts?" + queryString({ ...filter, page })),
    enabled: user?.role === "admin",
  });
  if (user?.role !== "admin") return <Redirect href="/(tabs)/dashboard" />;
  return (
    <View style={ui.screen}>
      <AppHeader />
      <FlatList
        data={query.isError ? [] : query.data?.items || []}
        keyExtractor={(a) => String(a.id)}
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
                <Text style={ui.title}>Tài khoản trạm</Text>
                <Text style={ui.muted}>
                  {number(query.data?.total)} tài khoản
                </Text>
              </View>
              <Button title="+ Tạo tài khoản" onPress={() => setEdit(null)} />
            </View>
            <View style={ui.card}>
              <Field label="TÊN TÀI KHOẢN" value={q} onChange={setQ} />
              <Field
                label="MÃ TRẠM"
                value={station}
                onChange={setStation}
                numeric
                placeholder="Để trống để xem tất cả"
              />
              {validation ? <Text style={ui.error}>{validation}</Text> : null}
              <Button
                title="Tìm kiếm"
                secondary
                onPress={() => {
                  if (station && !/^[1-9]\d*$/.test(station)) {
                    setValidation("Mã trạm phải là số nguyên dương.");
                    return;
                  }
                  setValidation("");
                  setFilter({ q, stationId: station });
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
        renderItem={({ item: a }) => (
          <View style={[ui.card, { marginBottom: 12 }]}>
            <View style={[ui.row, { justifyContent: "space-between" }]}>
              <Text style={ui.heading}>{a.username}</Text>
              <Badge
                label={a.enabled ? "Đang mở" : "Đã khóa"}
                tone={a.enabled ? "green" : "red"}
              />
            </View>
            <Text style={ui.muted}>
              Tài khoản #{a.id} · Trạm #{a.stationId} · {a.roleName}
            </Text>

            <Button
              title="Quản lý tài khoản"
              secondary
              onPress={() => setEdit(a)}
            />
          </View>
        )}
        ListFooterComponent={
          query.data && !query.error ? (
            <Pager page={page} total={query.data.total} onChange={setPage} />
          ) : null
        }
      />
      {edit !== undefined ? (
        <AccountForm
          account={edit}
          stationId={filter.stationId}
          onClose={() => setEdit(undefined)}
        />
      ) : null}
    </View>
  );
}
