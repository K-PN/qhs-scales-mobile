import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  type ViewStyle,
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
  danger = false,
  icon,
}: {
  title: string;
  onPress: () => void;
  busy?: boolean;
  secondary?: boolean;
  disabled?: boolean;
  danger?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        ui.button,
        { flexDirection: "row", gap: 8 },
        secondary && {
          backgroundColor: c.white,
          borderColor: c.line,
          borderWidth: 1,
        },
        danger && { backgroundColor: c.red },
        pressed && { opacity: 0.8 },
        (disabled || busy) && { opacity: 0.5 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={secondary ? c.blue : c.white} />
      ) : (
        <>
          {icon ? (
            <Ionicons
              name={icon}
              size={19}
              color={secondary ? c.navy : c.white}
            />
          ) : null}
          <Text
            style={[
              ui.buttonText,
              { flexShrink: 1 },
              secondary && { color: c.navy },
            ]}
          >
            {title}
          </Text>
        </>
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
              minHeight: 44,
              justifyContent: "center",
              borderRadius: 12,
              borderWidth: 1,
              borderColor: item.value === value ? c.blue : c.line,
              paddingVertical: 8,
            },
          ]}
        >
          <Text
            style={{
              color: item.value === value ? c.white : c.navy,
              fontWeight: "600",
              fontSize: 14,
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
    green: [c.navy, c.soft],
    amber: [c.amber, c.warning],
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
      <View style={{ alignItems: "center", padding: 24 }}>
        <ActivityIndicator
          accessibilityLabel="Đang tải dữ liệu"
          color={c.blue}
        />
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
      </View>
    );
  return null;
}
type DragPoint = { pageX: number; pageY: number };
type DragTouches = {
  touches: ArrayLike<DragPoint>;
  changedTouches: ArrayLike<DragPoint>;
};

export function Sheet({
  visible,
  title,
  onClose,
  children,
  footer,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const [offset] = useState(() => new Animated.Value(0));
  const scrollView = useRef<ScrollView>(null);
  const scrollOffset = useRef(0);
  const origin = useRef<{ x: number; y: number; handle: boolean } | null>(null);
  const moved = useRef(false);

  useEffect(() => {
    if (visible) return;
    origin.current = null;
    scrollOffset.current = 0;
    moved.current = false;
    offset.setValue(0);
  }, [offset, visible]);

  const startDrag = useCallback(({ touches }: DragTouches, handle = false) => {
    const first = touches.length === 1 ? touches[0] : null;
    origin.current =
      first && (handle || scrollOffset.current <= 1)
        ? { x: first.pageX, y: first.pageY, handle }
        : null;
  }, []);
  const distance = useCallback((point: DragPoint | undefined) => {
    const first = origin.current;
    if (!point || !first || (!first.handle && scrollOffset.current > 1))
      return 0;
    const dy = point.pageY - first.y;
    return dy > 7 && dy > Math.abs(point.pageX - first.x) * 1.4 ? dy : 0;
  }, []);
  const cancelDrag = useCallback(() => {
    origin.current = null;
    if (!moved.current) return;
    moved.current = false;
    Animated.spring(offset, {
      toValue: 0,
      speed: 25,
      bounciness: 0,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [offset]);
  const moveDrag = useCallback(
    ({ touches }: DragTouches) => {
      if (!origin.current) return;
      if (touches.length !== 1) return cancelDrag();
      const dy = distance(touches[0]);
      if (dy || moved.current) {
        moved.current = true;
        offset.setValue(dy);
      }
    },
    [cancelDrag, distance, offset],
  );
  const finishDrag = useCallback(
    ({ touches, changedTouches }: DragTouches) => {
      if (!origin.current) return;
      const dismiss = !touches.length && distance(changedTouches[0]) >= 56;
      cancelDrag();
      if (dismiss) onClose();
    },
    [cancelDrag, distance, onClose],
  );

  useEffect(() => {
    if (!visible || Platform.OS !== "web") return;
    const node = scrollView.current?.getScrollableNode() as unknown as
      | HTMLElement
      | undefined;
    if (!node) return;
    const touchStart = (event: TouchEvent) => startDrag(event);
    const touchMove = (event: TouchEvent) => {
      if (event.cancelable && distance(event.touches[0]))
        event.preventDefault();
      moveDrag(event);
    };
    node.addEventListener("touchstart", touchStart, { passive: true });
    node.addEventListener("touchmove", touchMove, { passive: false });
    node.addEventListener("touchend", finishDrag);
    node.addEventListener("touchcancel", cancelDrag);
    return () => {
      node.removeEventListener("touchstart", touchStart);
      node.removeEventListener("touchmove", touchMove);
      node.removeEventListener("touchend", finishDrag);
      node.removeEventListener("touchcancel", cancelDrag);
    };
  }, [visible, startDrag, distance, moveDrag, finishDrag, cancelDrag]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable
          accessible={false}
          focusable={false}
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.anchor}
        >
          <Animated.View
            style={[styles.modal, { transform: [{ translateY: offset }] }]}
          >
            <SafeAreaView edges={["bottom"]} style={{ flexShrink: 1 }}>
              <View
                onTouchStart={(event) => startDrag(event.nativeEvent, true)}
                onTouchMove={(event) => moveDrag(event.nativeEvent)}
                onTouchEnd={(event) => finishDrag(event.nativeEvent)}
                onTouchCancel={cancelDrag}
                style={[
                  styles.sheetHeader,
                  Platform.OS === "web" &&
                    ({ touchAction: "none" } as ViewStyle),
                ]}
              >
                <View style={styles.handle} />
                <View style={[ui.row, { justifyContent: "space-between" }]}>
                  <Text
                    accessibilityRole="header"
                    style={[ui.heading, { flex: 1 }]}
                  >
                    {title}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Đóng"
                    onPress={onClose}
                    style={[
                      ui.iconButton,
                      { borderRadius: 22, backgroundColor: c.soft },
                    ]}
                  >
                    <Ionicons name="close" size={22} color={c.navy} />
                  </Pressable>
                </View>
              </View>
              <ScrollView
                ref={scrollView}
                bounces={false}
                overScrollMode="never"
                scrollEventThrottle={16}
                onScroll={(event) => {
                  scrollOffset.current = event.nativeEvent.contentOffset.y;
                }}
                onTouchStart={
                  Platform.OS === "web"
                    ? undefined
                    : (event) => startDrag(event.nativeEvent)
                }
                onTouchMove={
                  Platform.OS === "web"
                    ? undefined
                    : (event) => moveDrag(event.nativeEvent)
                }
                onTouchEnd={
                  Platform.OS === "web"
                    ? undefined
                    : (event) => finishDrag(event.nativeEvent)
                }
                onTouchCancel={Platform.OS === "web" ? undefined : cancelDrag}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                contentContainerStyle={{ padding: 16, paddingTop: 3, gap: 12 }}
              >
                {children}
              </ScrollView>
              {footer ? <View style={styles.footer}>{footer}</View> : null}
            </SafeAreaView>
          </Animated.View>
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
    backgroundColor: "rgba(9,40,33,.55)",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  anchor: { width: "100%", maxWidth: 640, maxHeight: "92%", flexShrink: 1 },
  sheetHeader: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    paddingTop: 9,
    backgroundColor: c.white,
    gap: 5,
    borderBottomWidth: 1,
    borderColor: c.line,
  },
  handle: {
    alignSelf: "center",
    width: 38,
    height: 4,
    borderRadius: 4,
    backgroundColor: "#AAC8BB",
  },
  footer: {
    padding: 12,
    paddingHorizontal: 16,
    gap: 8,
    borderTopWidth: 1,
    borderColor: c.line,
    backgroundColor: c.white,
  },
  modal: {
    backgroundColor: c.bg,
    flexShrink: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
});
