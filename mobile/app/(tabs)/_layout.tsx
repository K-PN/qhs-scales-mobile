import { Redirect, Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/authStore";
import { c } from "../../lib/theme";
import { State } from "../../components/UI";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useWindowDimensions } from "react-native";
export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const user = useAuthStore((s) => s.user),
    ready = useAuthStore((s) => s.ready);
  if (!ready) return <State loading />;
  if (!user) return <Redirect href="/login" />;
  const admin = user.role === "admin";
  const bottomPadding = Math.max(8, insets.bottom);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.blue,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: {
          borderTopColor: c.line,
          backgroundColor: "white",
          height: 68 + bottomPadding + Math.max(0, fontScale - 1) * 18,
          paddingTop: 6,
          paddingBottom: bottomPadding,
        },
        tabBarLabelPosition: "below-icon",
        tabBarItemStyle: { paddingVertical: 4 },
        tabBarLabelStyle: {
          fontSize: admin && width < 360 ? 10 : 11,
          lineHeight: 16,
          fontWeight: "600",
          margin: 0,
        },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: admin ? "Điều hành" : "Tổng quan",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="weighings"
        options={{
          title: "Dữ liệu cân",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="car-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="stations"
        options={{
          title: "Trạm cân",
          href: admin ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="business-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="accounts"
        options={{
          title: "Nhân sự",
          href: admin ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Tài khoản",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen name="index" options={{ href: null }} />
    </Tabs>
  );
}
