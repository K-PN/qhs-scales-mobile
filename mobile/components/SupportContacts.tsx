import { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { c, ui } from "../lib/theme";

const contacts = [
  { label: "Hỗ trợ phần mềm", phone: "0867 580 468", number: "0867580468" },
  { label: "Liên hệ mua cân", phone: "0946 161 468", number: "0946161468" },
  { label: "Kỹ thuật sửa cân", phone: "0869 271 468", number: "0869271468" },
];
const website = "https://candientuquochung.com/";

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
    <View style={ui.card}>
      <Text style={ui.heading}>Liên hệ & hỗ trợ</Text>
      {contacts.map((contact, index) => (
        <View key={contact.number}>
          {index > 0 ? <View style={ui.separator} /> : null}
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`${contact.label}: ${contact.phone}`}
            onPress={() => void open(`tel:${contact.number}`)}
            style={[ui.row, { minHeight: 70, paddingVertical: 12 }]}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={ui.muted}>{contact.label}</Text>
              <Text style={[ui.heading, { color: c.blue, fontSize: 18 }]}>
                {contact.phone}
              </Text>
            </View>
            <Ionicons name="call-outline" size={22} color={c.blue} />
          </Pressable>
        </View>
      ))}
      <View style={ui.separator} />
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Website Cân điện tử Quốc Hưng"
        onPress={() => void open(website)}
        style={[ui.row, { minHeight: 64, paddingVertical: 10 }]}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={ui.muted}>Website</Text>
          <Text style={[ui.body, { color: c.blue, fontWeight: "600" }]}>
            candientuquochung.com
          </Text>
        </View>
        <Ionicons name="open-outline" size={21} color={c.blue} />
      </Pressable>
      {error ? (
        <Text accessibilityRole="alert" style={ui.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
