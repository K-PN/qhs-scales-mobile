import { useState } from "react";
import { Keyboard, Text, View } from "react-native";
import { localDay, ui } from "../lib/theme";
import Calendar from "./Calendar";
import { Button, Field, Sheet } from "./UI";
import { Segments } from "./BrowseUI";

export interface ReportPeriod {
  startDate: string;
  endDate: string;
}
const displayDate = (value: string) => value.split("-").reverse().join("/");
function parseDate(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const iso = `${match[3]}-${match[2]}-${match[1]}`;
  const parsed = new Date(iso + "T00:00:00Z");
  return Number(match[3]) > 0 &&
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === iso
    ? iso
    : null;
}

export default function OverviewPeriod({
  value,
  onChange,
}: {
  value: ReportPeriod;
  onChange: (value: ReportPeriod) => void;
}) {
  const [period, setPeriod] = useState("today");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ startDate: "", endDate: "" });
  const [calendar, setCalendar] = useState<keyof ReportPeriod | null>(null);
  const [error, setError] = useState("");
  function selectPeriod(next: string) {
    if (next === "custom") {
      setDraft({
        startDate: displayDate(value.startDate),
        endDate: displayDate(value.endDate),
      });
      setCalendar(null);
      setError("");
      setOpen(true);
      return;
    }
    setPeriod(next);
    onChange({
      startDate:
        next === "today"
          ? localDay()
          : next === "week"
            ? localDay(-6)
            : localDay().slice(0, 8) + "01",
      endDate: localDay(),
    });
  }
  function apply() {
    const startDate = parseDate(draft.startDate),
      endDate = parseDate(draft.endDate);
    if (!startDate || !endDate) {
      setError("Vui lòng nhập ngày hợp lệ theo dạng dd/mm/yyyy.");
      return;
    }
    if (startDate > endDate) {
      setError("Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.");
      return;
    }
    setPeriod("custom");
    onChange({ startDate, endDate });
    setOpen(false);
    Keyboard.dismiss();
  }
  return (
    <View style={{ gap: 10 }}>
      <Segments
        value={period}
        onChange={selectPeriod}
        items={[
          { value: "today", label: "Hôm nay" },
          { value: "week", label: "7 ngày" },
          { value: "month", label: "Tháng này" },
          { value: "custom", label: "Tùy chọn" },
        ]}
      />
      {period === "custom" ? (
        <Text style={ui.muted}>
          {displayDate(value.startDate)} – {displayDate(value.endDate)}
        </Text>
      ) : null}
      <Sheet
        visible={open}
        title="Khoảng thời gian tổng quan"
        onClose={() => setOpen(false)}
      >
        {(["startDate", "endDate"] as const).map((key) => (
          <View key={key} style={{ gap: 8 }}>
            <Field
              label={key === "startDate" ? "Từ ngày" : "Đến ngày"}
              value={draft[key]}
              placeholder="dd/mm/yyyy"
              onChange={(text) => {
                setDraft((current) => ({ ...current, [key]: text }));
                setError("");
              }}
            />
            <Button
              secondary
              title={
                key === "startDate" ? "Chọn ngày bắt đầu" : "Chọn ngày kết thúc"
              }
              onPress={() => {
                Keyboard.dismiss();
                setCalendar(calendar === key ? null : key);
              }}
            />
          </View>
        ))}
        {calendar ? (
          <Calendar
            key={calendar + draft[calendar]}
            value={parseDate(draft[calendar]) || value[calendar]}
            onChange={(day) => {
              setDraft((current) => ({
                ...current,
                [calendar]: displayDate(day),
              }));
              setCalendar(null);
              setError("");
            }}
          />
        ) : null}
        {error ? (
          <Text accessibilityRole="alert" style={ui.error}>
            {error}
          </Text>
        ) : null}
        <Button title="Áp dụng khoảng thời gian" onPress={apply} />
      </Sheet>
    </View>
  );
}
