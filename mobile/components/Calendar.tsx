import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { c, ui, localDay } from "../lib/theme";
export default function Calendar({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [month, setMonth] = useState(
    () => new Date((value || localDay()).slice(0, 7) + "-01T12:00:00"),
  );
  const year = month.getFullYear(),
    m = month.getMonth(),
    first = (new Date(year, m, 1).getDay() + 6) % 7,
    total = new Date(year, m + 1, 0).getDate();
  const values = Array.from(
    { length: Math.ceil((first + total) / 7) * 7 },
    (_, i) => i - first + 1,
  );
  return (
    <View style={[ui.card, { padding: 12 }]}>
      <View style={[ui.row, { justifyContent: "space-between" }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tháng trước"
          onPress={() => setMonth(new Date(year, m - 1, 1))}
          style={{ padding: 12 }}
        >
          <Ionicons name="chevron-back" size={20} color={c.blue} />
        </Pressable>
        <Text style={ui.heading}>
          Tháng {m + 1}, {year}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tháng sau"
          onPress={() => setMonth(new Date(year, m + 1, 1))}
          style={{ padding: 12 }}
        >
          <Ionicons name="chevron-forward" size={20} color={c.blue} />
        </Pressable>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((d) => (
          <Text
            key={d}
            style={{
              width: "14.2857%",
              textAlign: "center",
              paddingVertical: 8,
              color: c.muted,
              fontSize: 12,
            }}
          >
            {d}
          </Text>
        ))}
        {values.map((d, i) => {
          const valid = d >= 1 && d <= total,
            key =
              year +
              "-" +
              String(m + 1).padStart(2, "0") +
              "-" +
              String(d).padStart(2, "0"),
            selected = key === value;
          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={valid ? key : "Ngoài tháng"}
              disabled={!valid}
              onPress={() => onChange(key)}
              style={{
                width: "14.2857%",
                height: 42,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: selected ? c.blue : "transparent",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{ fontSize: 14, color: selected ? "white" : c.text }}
                >
                  {valid ? d : ""}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
