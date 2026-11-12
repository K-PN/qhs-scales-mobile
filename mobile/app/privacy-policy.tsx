import { Link, useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { c, ui } from "../lib/theme";
import { privacyPolicy as policy } from "../content/privacy-policy";

const bodyStyle = { fontSize: 17, lineHeight: 29, color: c.text };

export default function PrivacyPolicy() {
  const router = useRouter();
  return (
    <SafeAreaView edges={["bottom"]} style={ui.screen}>
      <View
        style={[
          ui.row,
          {
            padding: 12,
            backgroundColor: c.white,
            borderBottomWidth: 1,
            borderBottomColor: c.line,
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/login")
          }
          style={{
            minHeight: 48,
            padding: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Ionicons name="arrow-back" size={24} color={c.blue} />
          <Text style={{ fontSize: 15, fontWeight: "600", color: c.blue }}>
            Quay lại
          </Text>
        </Pressable>
        <Text style={[ui.heading, { flex: 1 }]}>Quyền riêng tư</Text>
      </View>
      <ScrollView
        contentContainerStyle={[
          ui.content,
          { maxWidth: 720, gap: 24, paddingBottom: 32 },
        ]}
      >
        <Text accessibilityRole="header" style={ui.title}>
          {policy.title}
        </Text>
        <Text style={ui.muted}>
          {policy.appName} · Cập nhật: {policy.updatedOn}
        </Text>
        <Text
          selectable
          style={[
            bodyStyle,
            { backgroundColor: c.soft, padding: 16, borderRadius: 12 },
          ]}
        >
          {policy.introduction}
        </Text>
        {policy.sections.map((section) => (
          <View key={section.title} style={[ui.card, { gap: 16 }]}>
            <Text
              accessibilityRole="header"
              style={[
                ui.heading,
                { fontSize: 20, lineHeight: 29, color: c.navy },
              ]}
            >
              {section.title}
            </Text>
            {section.paragraphs.map((paragraph) => (
              <Text selectable key={paragraph} style={bodyStyle}>
                {paragraph}
              </Text>
            ))}
          </View>
        ))}
        <View style={ui.card}>
          <Text style={ui.heading}>{policy.company}</Text>
          <Text selectable style={ui.body}>
            {policy.address}
          </Text>
          <Link
            href={`mailto:${policy.email}`}
            style={[ui.body, { color: c.blue, paddingVertical: 10 }]}
          >
            {policy.email}
          </Link>
          <Link
            href={`tel:${policy.phoneNumber}`}
            style={[ui.body, { color: c.blue, paddingVertical: 10 }]}
          >
            {policy.phone}
          </Link>
          <Link
            href={policy.website}
            style={[ui.body, { color: c.blue, paddingVertical: 10 }]}
          >
            Website Quốc Hưng
          </Link>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
