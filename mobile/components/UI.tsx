import { ReactNode, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { c, ui } from "../lib/theme";
export function Button({
  title,
  onPress,
  busy = false,
  secondary = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  busy?: boolean;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled || busy}
      onPress={onPress}
      style={[
        ui.button,
        secondary && { backgroundColor: c.soft },
        (disabled || busy) && { opacity: 0.5 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={secondary ? c.blue : c.white} />
      ) : (
        <Text style={[ui.buttonText, secondary && { color: c.blue }]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}
export function Field({
  label,
  value,
  onChange,
  placeholder,
  secret = false,
  numeric = false,
  onSubmit,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  secret?: boolean;
  numeric?: boolean;
  onSubmit?: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  return (
    <View style={{ gap: 7 }}>
      <Text style={ui.label}>{label}</Text>
      <View style={{ position: "relative" }}>
        <TextInput
          accessibilityLabel={label}
          style={[ui.input, secret && { paddingRight: 52 }]}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={c.muted}
          secureTextEntry={secret && !revealed}
          returnKeyType={onSubmit ? "go" : "next"}
          onSubmitEditing={onSubmit}
          autoCapitalize="none"
          keyboardType={numeric ? "number-pad" : "default"}
        />
        {secret ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            onPress={() => setRevealed(!revealed)}
            style={{ position: "absolute", right: 4, top: 2, padding: 12 }}
          >
            <Ionicons
              name={revealed ? "eye-off-outline" : "eye-outline"}
              size={21}
              color={c.muted}
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
export function Chips({
  items,
  value,
  onChange,
}: {
  items: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={ui.wrap}>
      {items.map((item) => (
        <Pressable
          key={item.value}
          accessibilityRole="button"
          accessibilityState={{ selected: item.value === value }}
          onPress={() => onChange(item.value)}
          style={[
            ui.pill,
            {
              backgroundColor: item.value === value ? c.blue : c.soft,
              paddingVertical: 10,
            },
          ]}
        >
          <Text
            style={{
              color: item.value === value ? c.white : c.muted,
              fontWeight: "600",
              fontSize: 13,
            }}
          >
            {item.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
export function Badge({
  label,
  tone = "blue",
}: {
  label: string;
  tone?: "blue" | "green" | "amber" | "red";
}) {
  const colors = {
    blue: [c.blue, c.soft],
    green: [c.teal, "#EAF4EB"],
    amber: [c.amber, "#FFF5DD"],
    red: [c.red, "#FCECEE"],
  };
  return (
    <View
      style={[
        ui.pill,
        { alignSelf: "flex-start", backgroundColor: colors[tone][1] },
      ]}
    >
      <Text style={{ color: colors[tone][0], fontSize: 11, fontWeight: "700" }}>
        {label}
      </Text>
    </View>
  );
}
export function State({
  loading,
  error,
  empty,
  onRetry,
}: {
  loading?: boolean;
  error?: Error | null;
  empty?: boolean;
  onRetry?: () => void;
}) {
  if (loading)
    return (
      <View style={[ui.card, { alignItems: "center", padding: 40 }]}>
        <ActivityIndicator color={c.blue} />
        <Text style={ui.muted}>Đang tải dữ liệu…</Text>
      </View>
    );
  if (error)
    return (
      <View style={ui.card}>
        <Text style={ui.error}>{error.message}</Text>
        {onRetry ? (
          <Button secondary title="Thử lại" onPress={onRetry} />
        ) : null}
      </View>
    );
  if (empty)
    return (
      <View style={[ui.card, { alignItems: "center", padding: 32 }]}>
        <Ionicons name="file-tray-outline" size={32} color={c.muted} />
        <Text style={ui.heading}>Chưa có dữ liệu</Text>
        <Text style={ui.muted}>Thử thay đổi bộ lọc hoặc khoảng thời gian.</Text>
      </View>
    );
  return null;
}
export function Sheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modal}
        >
          <SafeAreaView edges={["bottom"]} style={{ flexShrink: 1 }}>
            <View
              style={[ui.row, { padding: 20, justifyContent: "space-between" }]}
            >
              <Text style={[ui.heading, { flex: 1 }]}>{title}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Đóng"
                onPress={onClose}
                hitSlop={12}
              >
                <Ionicons name="close" size={24} color={c.text} />
              </Pressable>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ padding: 20, paddingTop: 0, gap: 16 }}
            >
              {children}
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
export function Pager({
  page,
  total,
  limit = 20,
  onChange,
}: {
  page: number;
  total: number;
  limit?: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={[ui.row, { justifyContent: "space-between" }]}>
      <Button
        secondary
        title="Trước"
        disabled={page <= 1}
        onPress={() => onChange(page - 1)}
      />
      <Text style={ui.muted}>
        {page} / {Math.max(1, Math.ceil(total / limit))}
      </Text>
      <Button
        secondary
        title="Sau"
        disabled={page * limit >= total}
        onPress={() => onChange(page + 1)}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(9,28,48,.5)",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  modal: {
    backgroundColor: c.bg,
    width: "100%",
    maxWidth: 640,
    maxHeight: "92%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
});
