import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AppHeader from "./AppHeader";
import OverviewHero from "./OverviewHero";
import { c, ui } from "../lib/theme";
import Calendar from "./Calendar";
import { Button, Sheet } from "./UI";
import { FilterControl, Segments } from "./BrowseUI";
import { kg, stationTime, stationToday } from "../lib/durian";

export const palette = {
  primary: c.blue,
  dark: c.navy,
  background: c.bg,
  border: c.line,
  soft: c.soft,
  text: c.text,
  muted: c.muted,
  white: c.white,
  warning: c.amber,
  warningBackground: c.warning,
};

export const ds = {
  page: ui.screen,
  content: ui.content,
  card: ui.card,
  row: { ...ui.wrap, alignItems: "center" as const, gap: 8 },
  between: {
    ...ui.wrap,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    gap: 8,
  },
  heading: ui.heading,
  body: { ...ui.body, flexShrink: 1 },
  muted: { ...ui.muted, flexShrink: 1 },
  weight: {
    color: c.navy,
    fontSize: 30,
    fontWeight: "800" as const,
    fontVariant: ["tabular-nums" as const],
  },
  input: ui.input,
  warning: {
    color: c.amber,
    backgroundColor: c.warning,
    padding: 12,
    borderRadius: 12,
    fontSize: 14,
  },
};

export function DurianHeader({
  title,
  updatedAt,
  back,
  onRefresh,
  showStation,
  showAction,
}: {
  title: string;
  updatedAt?: number;
  back?: boolean;
  onRefresh?: () => void;
  showStation?: boolean;
  showAction?: boolean;
}) {
  const router = useRouter();
  return (
    <AppHeader
      title={title}
      showStation={showStation}
      showAction={showAction}
      updatedAt={updatedAt}
      onRefresh={onRefresh}
      onBack={
        back
          ? () =>
              router.canGoBack()
                ? router.back()
                : router.replace("/durian/tickets")
          : undefined
      }
    />
  );
}

export function Choice({
  children,
  selected,
  onPress,
}: {
  children: ReactNode;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: pressed ? 0.75 : 1,
        minHeight: 44,
        paddingHorizontal: 13,
        paddingVertical: 7,
        borderRadius: 12,
        justifyContent: "center",
        borderWidth: 1,
        borderColor: selected ? palette.primary : palette.border,
        backgroundColor: selected ? palette.primary : palette.white,
      })}
    >
      <Text
        style={{
          color: selected ? palette.white : palette.dark,
          fontSize: 14,
          fontWeight: "700",
        }}
      >
        {children}
      </Text>
    </Pressable>
  );
}

export function Status({
  running,
  children,
}: {
  running?: boolean;
  children: ReactNode;
}) {
  return (
    <View
      style={[
        ds.row,
        {
          borderRadius: 20,
          paddingHorizontal: 10,
          paddingVertical: 5,
          gap: 6,
          backgroundColor: running ? palette.soft : palette.background,
        },
      ]}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: running ? palette.primary : palette.muted,
        }}
      />
      <Text
        style={{
          color: running ? palette.dark : palette.muted,
          fontWeight: "700",
          fontSize: 13,
        }}
      >
        {children}
      </Text>
    </View>
  );
}

export function LoadState({
  loading,
  error,
  cached,
  retry,
}: {
  loading?: boolean;
  error?: Error | null;
  cached?: boolean;
  retry?: () => void;
}) {
  if (loading)
    return (
      <ActivityIndicator
        accessibilityLabel="Đang tải"
        color={palette.primary}
      />
    );
  if (!error) return null;
  const denied =
    "status" in error &&
    (error.status === 401 || error.status === 403 || error.status === 404);
  return (
    <View style={{ gap: 8, alignItems: "flex-start" }}>
      <Text accessibilityRole="alert" style={ds.warning}>
        {cached && !denied ? "Đang xem dữ liệu đã tải." : error.message}
      </Text>
      {retry ? <Choice onPress={retry}>Thử lại</Choice> : null}
    </View>
  );
}

export function Metric({
  weight,
  children,
  scene,
  label = "Tổng khối lượng",
}: {
  weight: number;
  children: ReactNode;
  scene?: "durian";
  label?: string;
}) {
  return (
    <OverviewHero
      label={label}
      value={kg(weight)}
      unit="kg"
      icon="scale-outline"
      scene={scene}
    >
      {children}
    </OverviewHero>
  );
}

export type Period = { startDate: string; endDate: string };
const display = (date: string) => date.split("-").reverse().join("/");
type PeriodMode = "today" | "day" | "month" | "range";
const periodOptions = [
  { value: "today", label: "Hôm nay" },
  { value: "day", label: "Ngày" },
  { value: "month", label: "Tháng" },
  { value: "range", label: "Khoảng ngày" },
] as const;

function monthPeriod(month: string): Period | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;
  const last = new Date(month + "-01T00:00:00Z");
  last.setUTCMonth(last.getUTCMonth() + 1, 0);
  return { startDate: month + "-01", endDate: month + "-" + last.getUTCDate() };
}

export function PeriodPicker({
  value,
  onChange,
}: {
  value: Period;
  onChange: (period: Period) => void;
}) {
  const { width } = useWindowDimensions();
  const today = stationToday();
  const isToday = value.startDate === today && value.endDate === today;
  const singleDay = value.startDate === value.endDate;
  const month = monthPeriod(value.startDate.slice(0, 7));
  const fullMonth =
    month?.startDate === value.startDate && month?.endDate === value.endDate;
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<PeriodMode>("today");
  const [draft, setDraft] = useState<Period>(value);
  const [calendar, setCalendar] = useState<keyof Period>("startDate");
  const [error, setError] = useState("");
  function show() {
    setDraft(value);
    setCalendar("startDate");
    setMode(
      isToday ? "today" : singleDay ? "day" : fullMonth ? "month" : "range",
    );
    setError("");
    setOpen(true);
  }
  function apply() {
    let next = draft;
    if (mode === "today") next = { startDate: today, endDate: today };
    if (mode === "day")
      next = { startDate: draft.startDate, endDate: draft.startDate };
    if (mode === "month") {
      const selected = monthPeriod(draft.startDate.slice(0, 7));
      if (!selected) return setError("Nhập tháng theo dạng YYYY-MM.");
      next = selected;
    }
    if (!validDate(next.startDate) || !validDate(next.endDate))
      return setError("Nhập ngày hợp lệ theo dạng YYYY-MM-DD.");
    if (next.startDate > next.endDate)
      return setError("Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.");
    onChange(next);
    setOpen(false);
  }
  const label = isToday
    ? "Hôm nay"
    : fullMonth
      ? "Tháng " + value.startDate.slice(0, 7).split("-").reverse().join("/")
      : singleDay
        ? display(value.startDate)
        : display(value.startDate) + " – " + display(value.endDate);
  return (
    <>
      <FilterControl
        label="Kỳ báo cáo"
        value={label}
        icon="calendar-outline"
        onPress={show}
      />
      <Sheet
        visible={open}
        title="Kỳ báo cáo"
        onClose={() => setOpen(false)}
        footer={<Button title="Áp dụng" onPress={apply} />}
      >
        <Segments
          items={periodOptions}
          value={mode}
          onChange={(next) => {
            setMode(next);
            setError("");
            setCalendar("startDate");
            if (!validDate(draft.startDate)) {
              const candidate = monthPeriod(draft.startDate);
              setDraft({
                startDate: candidate?.startDate ?? today,
                endDate: draft.endDate,
              });
            }
          }}
        />
        {mode === "month" ? (
          <DateInput
            label="Tháng (YYYY-MM)"
            value={draft.startDate.slice(0, 7)}
            maxLength={7}
            onChange={(startDate) =>
              setDraft((previous) => ({ ...previous, startDate }))
            }
          />
        ) : null}
        {mode === "day" || mode === "range" ? (
          <>
            {mode === "range" ? (
              <View style={ds.row}>
                <Choice
                  selected={calendar === "startDate"}
                  onPress={() => setCalendar("startDate")}
                >
                  Từ {display(draft.startDate)}
                </Choice>
                <Choice
                  selected={calendar === "endDate"}
                  onPress={() => setCalendar("endDate")}
                >
                  Đến {display(draft.endDate)}
                </Choice>
              </View>
            ) : null}
            <DateInput
              label={
                calendar === "endDate"
                  ? "Đến ngày (YYYY-MM-DD)"
                  : "Ngày (YYYY-MM-DD)"
              }
              value={draft[calendar]}
              maxLength={10}
              onChange={(day) =>
                setDraft((previous) => ({ ...previous, [calendar]: day }))
              }
            />
            {width >= 400 ? (
              <Calendar
                key={calendar}
                accent={palette.primary}
                value={validDate(draft[calendar]) ? draft[calendar] : today}
                onChange={(day) =>
                  setDraft((previous) => ({ ...previous, [calendar]: day }))
                }
              />
            ) : null}
          </>
        ) : null}
        {error ? (
          <Text accessibilityRole="alert" style={ds.warning}>
            {error}
          </Text>
        ) : null}
      </Sheet>
    </>
  );
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function DateInput({
  label,
  value,
  maxLength,
  onChange,
}: {
  label: string;
  value: string;
  maxLength: number;
  onChange: (value: string) => void;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={ds.body}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        style={ds.input}
        value={value}
        maxLength={maxLength}
        onChangeText={onChange}
      />
    </View>
  );
}
