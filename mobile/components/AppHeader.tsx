import {
  Image,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useIsMutating } from "@tanstack/react-query";
import { c, ui } from "../lib/theme";
import { useAuthStore } from "../store/authStore";
import { queryClient } from "../lib/api";
import Brand from "./Brand";

const appIcon: ImageSourcePropType = require("../assets/app-icon.png");
const timeFormat = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Ho_Chi_Minh",
});
const dateFormat = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Asia/Ho_Chi_Minh",
});

export default function AppHeader({
  title,
  subtitle,
  showStation,
  updatedAt,
  onRefresh,
  onBack,
  showAction = true,
}: {
  title?: string;
  subtitle?: string;
  showStation?: boolean;
  updatedAt?: number;
  onRefresh?: () => void;
  onBack?: () => void;
  showAction?: boolean;
} = {}) {
  const router = useRouter();
  const stationName = useAuthStore((state) => state.user?.stationName);
  const stationType = useAuthStore((state) => state.user?.stationType);
  const sources = useAuthStore((state) => state.user?.databaseSources);
  const adminSource = useAuthStore((state) => state.adminSource);
  const setAdminSource = useAuthStore((state) => state.setAdminSource);
  const isMutating = useIsMutating() > 0;
  const context = subtitle ?? (showStation ? stationName : undefined);
  const time = updatedAt ? timeFormat.format(updatedAt) : null;
  const day = updatedAt ? dateFormat.format(updatedAt) : null;
  const timeLabel = time ? "Lấy dữ liệu lúc " + time + ", " + day : undefined;
  return (
    <LinearGradient
      colors={[c.white, "#EAF6F0"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.background}
    >
      <View style={styles.header}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
            onPress={onBack}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-back" size={22} color={c.navy} />
          </Pressable>
        ) : title ? (
          <View style={styles.brand}>
            <Image source={appIcon} accessible={false} style={styles.icon} />
          </View>
        ) : (
          <Brand width={134} />
        )}
        <View style={styles.caption}>
          {title ? (
            <Text accessibilityRole="header" style={ui.title}>
              {title}
            </Text>
          ) : null}
          {context ? (
            <Text style={ui.muted} numberOfLines={2}>
              {context}
            </Text>
          ) : null}
        </View>
        {showAction ? (
          <View style={styles.trailing}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                onRefresh ? "Làm mới dữ liệu" : "Thông tin tài khoản"
              }
              accessibilityHint={timeLabel}
              onPress={
                onRefresh ??
                (() =>
                  router.push(
                    stationType === "durian"
                      ? "/durian/account"
                      : "/(tabs)/profile",
                  ))
              }
              style={({ pressed }) => [
                styles.action,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name={onRefresh ? "refresh-outline" : "person-outline"}
                color={c.navy}
                size={20}
              />
            </Pressable>
            {time ? (
              <Text accessibilityLabel={timeLabel} style={styles.time}>
                {time}
                <Text style={styles.date}> · {day}</Text>
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
      {sources && sources.length > 1 ? (
        <View style={[ui.content, ui.row, { gap: 8, paddingBottom: 8 }]}>
          {sources.map((source) => (
            <Pressable
              key={source}
              accessibilityRole="button"
              accessibilityState={{ selected: adminSource === source, disabled: isMutating }}
              disabled={isMutating}
              onPress={() => {
                if (source === adminSource) return;
                queryClient.clear();
                setAdminSource(source);
              }}
              style={[styles.source, adminSource === source && { backgroundColor: c.soft }]}
            >
              <Text style={ui.body}>{source === "db1" ? "Database 1" : "Database 2"}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  background: { borderBottomWidth: 1, borderColor: c.line },
  source: { flex: 1, minHeight: 40, justifyContent: "center", alignItems: "center", borderWidth: 1, borderRadius: 12, borderColor: c.line, backgroundColor: c.white },
  header: {
    maxWidth: 780,
    width: "100%",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 9,
    gap: 10,
  },
  brand: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderColor: c.line,
    borderWidth: 1,
    backgroundColor: c.white,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: { width: 31, height: 31, borderRadius: 8 },
  caption: { flex: 1, minWidth: 0, gap: 2 },
  trailing: {
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 2,
    maxWidth: "37%",
    flexShrink: 1,
  },
  action: {
    ...ui.iconButton,
    alignSelf: "flex-end",
    borderRadius: 22,
    backgroundColor: c.white,
    borderWidth: 1,
    borderColor: c.line,
  },
  pressed: { backgroundColor: c.soft },
  time: {
    fontSize: 11,
    color: c.muted,
    fontWeight: "700",
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  date: { fontWeight: "400" },
});
