import { useRef, type ReactNode } from "react";
import {
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type GestureResponderEvent,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { c, ui } from "../lib/theme";

export function FilterControl({
  label,
  value,
  icon,
  onPress,
}: {
  label: string;
  value: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityValue={{ text: value }}
      onPress={onPress}
      style={({ pressed }) => [
        ui.row,
        styles.control,
        pressed && { backgroundColor: c.soft },
      ]}
    >
      <Ionicons name={icon} size={17} color={c.navy} />
      <Text style={{ flex: 1, color: c.navy, fontSize: 13, fontWeight: "700" }}>
        {value}
      </Text>
      <Ionicons name="chevron-down" size={14} color={c.muted} />
    </Pressable>
  );
}

export function SearchBar({
  label,
  placeholder,
  value,
  onChange,
  filter,
  active,
  filterLabel = "Bộ lọc",
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (text: string) => void;
  filter?: () => void;
  active?: boolean;
  filterLabel?: string;
}) {
  return (
    <View style={[ui.row, { gap: 8 }]}>
      <View style={[ui.row, styles.search]}>
        <Ionicons name="search-outline" size={20} color={c.muted} />
        <TextInput
          accessibilityLabel={label}
          placeholder={placeholder ?? label}
          placeholderTextColor={c.muted}
          value={value}
          maxLength={100}
          onChangeText={onChange}
          onSubmitEditing={Keyboard.dismiss}
          returnKeyType="search"
          style={{
            flex: 1,
            minWidth: 0,
            paddingVertical: 10,
            color: c.text,
            fontSize: 16,
          }}
        />
        {value ? (
          <Pressable
            accessibilityLabel="Xóa tìm kiếm"
            accessibilityRole="button"
            onPress={() => onChange("")}
            style={ui.iconButton}
          >
            <Ionicons name="close-circle" size={18} color={c.muted} />
          </Pressable>
        ) : null}
      </View>
      {filter ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={filterLabel}
          accessibilityState={{ selected: !!active }}
          onPress={() => {
            Keyboard.dismiss();
            filter();
          }}
          style={({ pressed }) => [
            ui.iconButton,
            styles.filter,
            active && { backgroundColor: c.navy, borderColor: c.navy },
            pressed && { opacity: 0.75 },
          ]}
        >
          <Ionicons
            name="options-outline"
            size={22}
            color={active ? c.white : c.navy}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

export function Segments<T extends string>({
  items,
  value,
  onChange,
  scroll = false,
}: {
  items: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  scroll?: boolean;
}) {
  const buttons = items.map((item) => (
    <Pressable
      key={item.value}
      accessibilityRole="button"
      accessibilityState={{ selected: value === item.value }}
      onPress={() => onChange(item.value)}
      style={({ pressed }) => [
        styles.segment,
        !scroll && { flex: 1 },
        value === item.value && styles.selected,
        pressed && { opacity: 0.75 },
      ]}
    >
      <Text
        style={[styles.segmentText, value === item.value && { color: c.navy }]}
      >
        {item.label}
      </Text>
    </Pressable>
  ));
  return scroll ? (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.segments}
    >
      {buttons}
    </ScrollView>
  ) : (
    <View style={styles.segments}>{buttons}</View>
  );
}

type Touch = { pageX: number; pageY: number };
export function SwipeSections<T extends string>({
  items,
  value,
  onChange,
  children,
}: {
  items: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  children: ReactNode;
}) {
  const origin = useRef<Touch | null>(null);
  function start(event: GestureResponderEvent) {
    const { touches } = event.nativeEvent;
    const first = touches.length === 1 ? touches[0] : null;
    origin.current = first ? { pageX: first.pageX, pageY: first.pageY } : null;
  }
  function end(event: GestureResponderEvent) {
    const first = origin.current;
    origin.current = null;
    if (!first || event.nativeEvent.touches.length) return;
    const last = event.nativeEvent.changedTouches[0];
    if (!last) return;
    const dx = last.pageX - first.pageX;
    const dy = last.pageY - first.pageY;
    if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const next =
      items[
        items.findIndex((item) => item.value === value) + (dx < 0 ? 1 : -1)
      ];
    if (next) onChange(next.value);
  }
  return (
    <View
      onTouchStart={start}
      onTouchEnd={end}
      onTouchCancel={() => {
        origin.current = null;
      }}
      style={[
        { flex: 1, gap: 10 },
        Platform.OS === "web" && ({ touchAction: "pan-y" } as ViewStyle),
      ]}
    >
      {children}
    </View>
  );
}

export function ReceiptRow({
  title,
  meta,
  secondary,
  value,
  unit,
  pending,
  onPress,
  label,
}: {
  title: string;
  meta: string;
  secondary?: string;
  value: string;
  unit?: string;
  pending?: boolean;
  onPress: () => void;
  label?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.receipt,
        pressed && { backgroundColor: c.soft },
      ]}
    >
      <View style={{ flex: 1, minWidth: 80, gap: 2 }}>
        <Text style={ui.heading}>{title}</Text>
        <Text style={ui.muted}>{meta}</Text>
        {secondary ? (
          <Text style={ui.muted} numberOfLines={2}>
            {secondary}
          </Text>
        ) : null}
      </View>
      <View style={{ alignItems: "flex-end", flexShrink: 1, gap: 2 }}>
        <Text style={styles.receiptValue}>
          {value}
          {unit ? <Text style={ui.muted}> {unit}</Text> : null}
        </Text>
        {pending ? (
          <Text style={{ color: c.amber, fontSize: 12, fontWeight: "700" }}>
            Chờ lần 2
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={17} color={c.muted} />
    </Pressable>
  );
}

export function SpecRows({
  items,
}: {
  items: readonly (readonly [string, string])[];
}) {
  return (
    <View style={[ui.card, { paddingVertical: 3, gap: 0 }]}>
      {items.map(([label, value], index) => (
        <View
          key={label}
          style={[
            ui.wrap,
            {
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: 5,
              paddingVertical: 11,
            },
            index > 0 && { borderTopWidth: 1, borderColor: c.line },
          ]}
        >
          <Text style={[ui.muted, { flexShrink: 1 }]}>{label}</Text>
          <Text
            selectable
            style={[ui.body, { fontWeight: "600", flexShrink: 1 }]}
          >
            {value}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  control: {
    flex: 1,
    minWidth: 0,
    minHeight: 46,
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 13,
    backgroundColor: c.white,
    borderWidth: 1,
    borderColor: c.line,
  },
  search: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    gap: 8,
    paddingLeft: 12,
    paddingRight: 3,
    backgroundColor: c.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.line,
  },
  filter: {
    height: 48,
    width: 48,
    backgroundColor: c.white,
    borderWidth: 1,
    borderColor: c.line,
  },
  segments: {
    flexDirection: "row",
    gap: 3,
    padding: 3,
    borderRadius: 14,
    backgroundColor: c.soft,
  },
  segment: {
    minHeight: 44,
    paddingHorizontal: 7,
    paddingVertical: 5,
    minWidth: 0,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentText: {
    color: c.muted,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  selected: { backgroundColor: c.white },
  receipt: {
    backgroundColor: c.white,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: c.line,
    padding: 13,
    minHeight: 65,
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
  },
  receiptValue: {
    color: c.navy,
    fontSize: 19,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    textAlign: "right",
  },
});
