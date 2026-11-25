import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { c, ui } from "../lib/theme";

type Contact = {
  label: string;
  display: string;
  href: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
};
const hotline: Contact = {
  label: "Hỗ trợ phần mềm",
  display: "0867 580 468",
  href: "tel:0867580468",
  icon: "headset-outline",
};
const contacts: Contact[] = [
  {
    label: "Liên hệ mua cân",
    display: "0946 161 468",
    href: "tel:0946161468",
    icon: "cart-outline",
  },
  {
    label: "Kỹ thuật sửa cân",
    display: "0869 271 468",
    href: "tel:0869271468",
    icon: "construct-outline",
  },
  {
    label: "Website",
    display: "candientuquochung.com",
    href: "https://candientuquochung.com/",
    icon: "globe-outline",
  },
];

export default function SupportContacts() {
  const [error, setError] = useState("");
  async function open(url: string) {
    setError("");
    try {
      await Linking.openURL(url);
    } catch {
      setError("Không thể mở liên kết trên thiết bị này.");
    }
  }
  return (
    <View style={{ gap: 9 }}>
      <Text accessibilityRole="header" style={ui.heading}>
        Liên hệ & hỗ trợ
      </Text>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={hotline.label + ": " + hotline.display}
        onPress={() => void open(hotline.href)}
        style={({ pressed }) => pressed && { opacity: 0.85 }}
      >
        <LinearGradient
          colors={[c.hero, c.navy]}
          end={{ x: 1, y: 1 }}
          style={styles.hotline}
        >
          <View style={[styles.icon, { backgroundColor: "#FFFFFF21" }]}>
            <Ionicons name={hotline.icon} size={23} color={c.white} />
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <Text style={styles.hotlineTitle}>{hotline.label}</Text>
            <Text style={styles.hotlineNumber}>{hotline.display}</Text>
          </View>
          <View style={[styles.icon, { backgroundColor: c.white }]}>
            <Ionicons name="call-outline" size={20} color={c.navy} />
          </View>
        </LinearGradient>
      </Pressable>
      <View style={styles.contacts}>
        {contacts.map(({ label, display, href, icon }, index) => {
          const phone = href.startsWith("tel:");
          return (
            <Pressable
              key={href}
              accessibilityRole="link"
              accessibilityLabel={
                phone ? label + ": " + display : "Website Cân điện tử Quốc Hưng"
              }
              onPress={() => void open(href)}
              style={({ pressed }) => [
                styles.row,
                index > 0 && { borderTopWidth: 1 },
                pressed && { backgroundColor: c.bg },
              ]}
            >
              <View style={styles.icon}>
                <Ionicons name={icon} size={20} color={c.navy} />
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text style={styles.contactTitle}>{label}</Text>
                <Text style={ui.muted}>{display}</Text>
              </View>
              <Ionicons
                name={phone ? "call-outline" : "open-outline"}
                size={17}
                color={c.navy}
              />
            </Pressable>
          );
        })}
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={ui.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hotline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 17,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: c.soft,
    alignItems: "center",
    justifyContent: "center",
  },
  hotlineTitle: { color: c.onHero, fontWeight: "700", fontSize: 13 },
  hotlineNumber: {
    color: c.white,
    fontWeight: "800",
    fontSize: 21,
    fontVariant: ["tabular-nums"],
  },
  contacts: {
    borderRadius: 17,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.white,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 11,
    minHeight: 61,
    borderColor: c.line,
  },
  contactTitle: { fontWeight: "700", color: c.text, fontSize: 15 },
});
