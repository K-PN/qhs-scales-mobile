import { StyleSheet } from "react-native";
export const c = {
  navy: "#185C2C",
  blue: "#298E40",
  teal: "#298E40",
  yellow: "#DFE62D",
  soft: "#EAF4EB",
  bg: "#F5F7F3",
  text: "#192B20",
  muted: "#758178",
  line: "#E5EBE3",
  white: "#FFFFFF",
  red: "#C43D4B",
  amber: "#A46B11",
};
export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.bg },
  content: {
    width: "100%",
    maxWidth: 1120,
    alignSelf: "center",
    padding: 16,
    gap: 16,
    paddingBottom: 36,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: {
    backgroundColor: c.white,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: c.line,
    gap: 10,
  },
  title: {
    fontSize: 27,
    fontWeight: "800",
    color: c.text,
    letterSpacing: -0.7,
  },
  heading: { fontSize: 18, fontWeight: "700", color: c.text },
  body: { fontSize: 15, lineHeight: 23, color: c.text },
  muted: { fontSize: 13, lineHeight: 20, color: c.muted },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: c.muted,
    letterSpacing: 0.7,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: c.text,
    backgroundColor: c.white,
  },
  button: {
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: c.blue,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: c.white, fontWeight: "700", fontSize: 14 },
  pill: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#E9F2FF",
  },
  separator: { height: 1, backgroundColor: c.line },
  error: { color: c.red, fontSize: 14, lineHeight: 21 },
});
export const number = (v: unknown) =>
  Number(v || 0).toLocaleString("vi-VN", { maximumFractionDigits: 2 });
export const dateTime = (v: string | null) =>
  v
    ? new Date(
        /^\d{4}-\d{2}-\d{2} /.test(v) ? v.replace(" ", "T") + "+07:00" : v,
      ).toLocaleString("vi-VN")
    : "—";
export function localDay(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}
