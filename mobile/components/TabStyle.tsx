import { Ionicons } from "@expo/vector-icons";
import { View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabNavigationOptions } from "@react-navigation/bottom-tabs";
import { c } from "../lib/theme";

export function useTabStyle(count: number): BottomTabNavigationOptions {
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const bottom = Math.max(8, insets.bottom);
  return {
    headerShown: false,
    tabBarHideOnKeyboard: true,
    tabBarLabelPosition: "below-icon",
    tabBarActiveTintColor: c.navy,
    tabBarInactiveTintColor: c.muted,
    tabBarStyle: {
      height: 60 + bottom + Math.max(0, fontScale - 1) * 24,
      paddingTop: 4,
      paddingBottom: bottom,
      borderTopColor: c.line,
      backgroundColor: c.white,
    },
    tabBarItemStyle: { minHeight: 44 },
    tabBarLabelStyle: {
      fontSize: count === 5 && width < 360 ? 10 : 11,
      fontWeight: "700",
      margin: 0,
    },
  };
}

export function tabIcon(
  name: React.ComponentProps<typeof Ionicons>["name"],
): BottomTabNavigationOptions["tabBarIcon"] {
  return ({ focused, color }) => (
    <View
      style={{
        width: 45,
        height: 28,
        borderRadius: 11,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: focused ? c.soft : "transparent",
      }}
    >
      <Ionicons name={name} size={21} color={color} />
    </View>
  );
}
