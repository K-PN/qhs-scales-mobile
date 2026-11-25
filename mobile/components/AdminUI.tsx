import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation } from "@tanstack/react-query";
import { api, queryClient } from "../lib/api";
import { c, ui } from "../lib/theme";
import { Button, Sheet } from "./UI";

export function AdminAdd({
  title,
  onPress,
}: {
  title: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [
        ui.iconButton,
        {
          width: 48,
          height: 48,
          backgroundColor: c.navy,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Ionicons name="add" size={25} color={c.white} />
    </Pressable>
  );
}

export function AdminIdentity({
  icon,
  title,
  subtitle,
  onActions,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  subtitle: string;
  onActions: () => void;
}) {
  return (
    <View style={ui.row}>
      <View style={[ui.iconButton, { backgroundColor: c.soft }]}>
        <Ionicons name={icon} size={22} color={c.navy} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={ui.heading}>{title}</Text>
        <Text style={ui.muted}>{subtitle}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={"Thao tác với " + title}
        onPress={onActions}
        style={({ pressed }) => [
          ui.iconButton,
          { backgroundColor: pressed ? c.soft : c.bg },
        ]}
      >
        <Ionicons name="ellipsis-horizontal" size={22} color={c.navy} />
      </Pressable>
    </View>
  );
}

export async function refreshAdminData() {
  await Promise.all(
    ["accounts", "stations", "summary", "stationLookup", "weighings", "weighing", "reportGroups"].map((key) =>
      queryClient.invalidateQueries({ queryKey: [key] }),
    ),
  );
}

export function AdminActions({
  label,
  noun,
  path,
  version,
  onClose,
  onEdit,
  secondary,
  onArchived,
}: {
  label: string;
  noun: "tài khoản" | "trạm cân";
  path: string;
  version: string;
  onClose: () => void;
  onEdit: () => void;
  onArchived: () => void;
  secondary: {
    label: string;
    icon: React.ComponentProps<typeof Ionicons>["name"];
    action: () => void;
  };
}) {
  const [confirm, setConfirm] = useState(false);
  const archive = useMutation({
    mutationFn: () =>
      api(path, { method: "DELETE", body: JSON.stringify({ version }) }),
    onSuccess: async () => {
      await refreshAdminData();
      onArchived();
    },
  });
  return (
    <Sheet
      visible
      title={confirm ? "Xóa " + noun : label}
      onClose={archive.isPending ? () => {} : onClose}
    >
      {confirm ? (
        <>
          <Text style={ui.body}>
            {label} sẽ bị vô hiệu hóa và ẩn khỏi danh sách quản lý. Lịch sử
            phiếu cân vẫn được giữ.
          </Text>
          {archive.error ? (
            <Text accessibilityRole="alert" style={ui.error}>
              {archive.error.message}
            </Text>
          ) : null}
          <Button
            danger
            icon="trash-outline"
            title={"Xác nhận xóa " + noun}
            busy={archive.isPending}
            onPress={() => archive.mutate()}
          />
          <Button
            secondary
            title="Quay lại"
            disabled={archive.isPending}
            onPress={() => {
              archive.reset();
              setConfirm(false);
            }}
          />
        </>
      ) : (
        <>
          <Button
            secondary
            icon="create-outline"
            title="Chỉnh sửa"
            onPress={onEdit}
          />
          <Button
            secondary
            icon={secondary.icon}
            title={secondary.label}
            onPress={secondary.action}
          />
          <Button
            danger
            icon="trash-outline"
            title={"Xóa " + noun}
            onPress={() => setConfirm(true)}
          />
        </>
      )}
    </Sheet>
  );
}
