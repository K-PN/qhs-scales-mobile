import { useState } from "react";
import { ScrollView, Text, View, Pressable, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { api, logout } from "../../lib/api";
import { c, ui } from "../../lib/theme";
import { useAuthStore } from "../../store/authStore";
import AppHeader from "../../components/AppHeader";
import Brand from "../../components/Brand";
import SupportContacts from "../../components/SupportContacts";
import { Button, State } from "../../components/UI";
import PrivacyPolicyLink from "../../components/PrivacyPolicyLink";
interface ProfileData {
  station: {
    id: number;
    name: string;
    address: string;
    phonenumber: string;
  } | null;
}
export default function Profile() {
  const user = useAuthStore((s) => s.user)!;
  const [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: ["stationProfile", user.role, user.id, user.stationId],
    queryFn: () => api<ProfileData>("/station/profile"),
  });
  const station = q.data?.station;
  async function signout() {
    setBusy(true);
    try {
      await logout();
    } catch {
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={ui.screen}>
      <AppHeader />
      <ScrollView contentContainerStyle={ui.content}>
        <Text style={ui.title}>Thông tin trạm</Text>
        <State
          loading={q.isPending}
          error={q.error}
          onRetry={() => void q.refetch()}
        />
        {q.data ? (
          <View style={ui.card}>
            <View style={{ alignItems: "center", paddingVertical: 20 }}>
              <Brand width={225} />
            </View>
            <Text style={[ui.heading, { fontSize: 22 }]}>
              {station?.name?.trim() || "Cân điện tử Quốc Hưng"}
            </Text>
            <View style={ui.separator} />
            {station?.address ? (
              <View
                style={[
                  ui.row,
                  { alignItems: "flex-start", paddingVertical: 10 },
                ]}
              >
                <Ionicons name="location-outline" size={22} color={c.blue} />
                <Text selectable style={[ui.body, { flex: 1 }]}>
                  {station.address}
                </Text>
              </View>
            ) : null}
            {station?.phonenumber ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Gọi trạm cân"
                onPress={() =>
                  void Linking.openURL(
                    "tel:" + station.phonenumber.replace(/[^+\d]/g, ""),
                  )
                }
                style={[ui.row, { paddingVertical: 10 }]}
              >
                <Ionicons name="call-outline" size={21} color={c.blue} />
                <Text style={[ui.body, { color: c.blue }]}>
                  {station.phonenumber}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        <SupportContacts />
        <PrivacyPolicyLink />
        <Button
          title="Đăng xuất"
          secondary
          busy={busy}
          onPress={() => void signout()}
        />
      </ScrollView>
    </View>
  );
}
