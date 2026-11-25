import { Redirect, Tabs } from "expo-router";
import { useAuthStore } from "../../store/authStore";
import { State } from "../../components/UI";
import { tabIcon, useTabStyle } from "../../components/TabStyle";

export default function TabsLayout() {
  const user = useAuthStore((s) => s.user);
  const ready = useAuthStore((s) => s.ready);
  const adminSource = useAuthStore((s) => s.adminSource);
  const admin = user?.role === "admin";
  const tabStyle = useTabStyle(admin ? 5 : 3);
  if (!ready) return <State loading />;
  if (!user) return <Redirect href="/login" />;
  if (user.stationType === "durian") return <Redirect href="/durian" />;
  if (user.stationType === "unknown")
    return <Redirect href="/station-unavailable" />;
  return (
    <Tabs key={admin ? adminSource : "station"} screenOptions={tabStyle}>
      <Tabs.Screen
        name="dashboard"
        options={{
          title: admin ? "Điều hành" : "Tổng quan",
          tabBarIcon: tabIcon("grid-outline"),
        }}
      />
      <Tabs.Screen
        name="weighings"
        options={{
          title: "Dữ liệu cân",
          tabBarIcon: tabIcon("receipt-outline"),
        }}
      />
      <Tabs.Screen
        name="stations"
        options={{
          title: "Trạm cân",
          href: admin ? undefined : null,
          tabBarIcon: tabIcon("business-outline"),
        }}
      />
      <Tabs.Screen
        name="accounts"
        options={{
          title: "Tài khoản",
          href: admin ? undefined : null,
          tabBarIcon: tabIcon("people-outline"),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: admin ? "Hồ sơ" : "Tài khoản",
          tabBarIcon: tabIcon("person-circle-outline"),
        }}
      />
      <Tabs.Screen name="index" options={{ href: null }} />
    </Tabs>
  );
}
