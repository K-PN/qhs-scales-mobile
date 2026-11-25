import { StyleSheet } from "react-native";
export const c = {
  navy: "#075545",
  blue: "#0C7F60",
  teal: "#0C7F60",
  hero: "#093E33",
  yellow: "#F7D977",
  onHero: "#D8F1E8",
  soft: "#E1F2EA",
  bg: "#F3F7F5",
  text: "#142F29",
  muted: "#49645C",
  line: "#D8E4DE",
  white: "#FFFFFF",
  red: "#A73143",
  amber: "#815619",
  warning: "#FFF4DC",
};
export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.bg },
  content: {
    width: "100%",
    maxWidth: 780,
    alignSelf: "center",
    padding: 16,
    gap: 12,
    paddingBottom: 24,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: {
    backgroundColor: c.white,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: c.line,
    gap: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: c.navy,
    letterSpacing: -0.7,
  },
  heading: { fontSize: 17, fontWeight: "800", color: c.text, flexShrink: 1 },
  body: { fontSize: 16, lineHeight: 24, color: c.text },
  muted: { fontSize: 13, lineHeight: 19, color: c.muted },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: c.muted,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
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
    backgroundColor: c.soft,
  },
  separator: { height: 1, backgroundColor: c.line },
  error: { color: c.red, fontSize: 14, lineHeight: 21 },
  iconButton: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
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
