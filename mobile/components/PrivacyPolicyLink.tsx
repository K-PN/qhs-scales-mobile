import { Link } from "expo-router";
import { Pressable, Text } from "react-native";
import { c, ui } from "../lib/theme";
import { PRIVACY_POLICY_URL } from "../lib/links";

export default function PrivacyPolicyLink() {
  return (
    <Link href={PRIVACY_POLICY_URL} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Chính sách quyền riêng tư"
        style={{
          minHeight: 48,
          justifyContent: "center",
          alignItems: "center",
          padding: 10,
        }}
      >
        <Text
          style={[
            ui.body,
            {
              color: c.blue,
              textAlign: "center",
              textDecorationLine: "underline",
            },
          ]}
        >
          Chính sách quyền riêng tư
        </Text>
      </Pressable>
    </Link>
  );
}
