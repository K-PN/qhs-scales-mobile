import { View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { c, ui } from "../lib/theme";
import Brand from "./Brand";
export default function AppHeader() {
  const router = useRouter();
  return (
    <View
      style={{
        backgroundColor: "white",
        borderBottomWidth: 1,
        borderBottomColor: c.line,
      }}
    >
      <View
        style={[
          ui.row,
          {
            maxWidth: 1120,
            width: "100%",
            alignSelf: "center",
            paddingHorizontal: 16,
            paddingVertical: 6,
            justifyContent: "space-between",
          },
        ]}
      >
        <Brand width={164} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Thông tin trạm"
          onPress={() => router.push("/(tabs)/profile")}
          style={{ padding: 12, borderRadius: 24, backgroundColor: c.soft }}
        >
          <Ionicons name="person-outline" size={21} color={c.blue} />
        </Pressable>
      </View>
    </View>
  );
}
