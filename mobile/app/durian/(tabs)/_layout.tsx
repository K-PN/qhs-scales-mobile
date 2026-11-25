import { Tabs } from "expo-router";
import { tabIcon, useTabStyle } from "../../../components/TabStyle";

export default function DurianTabs() {
  const tabStyle = useTabStyle(4);
  return (
    <Tabs screenOptions={tabStyle}>
      <Tabs.Screen
        name="index"
        options={{ title: "Tổng quan", tabBarIcon: tabIcon("grid-outline") }}
      />
      <Tabs.Screen
        name="tickets"
        options={{ title: "Phiếu cân", tabBarIcon: tabIcon("receipt-outline") }}
      />
      <Tabs.Screen
        name="reports"
        options={{ title: "Báo cáo", tabBarIcon: tabIcon("bar-chart-outline") }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Tài khoản",
          tabBarIcon: tabIcon("person-circle-outline"),
        }}
      />
    </Tabs>
  );
}
