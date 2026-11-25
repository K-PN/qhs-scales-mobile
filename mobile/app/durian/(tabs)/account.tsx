import { ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import SupportContacts from "../../../components/SupportContacts";
import PrivacyPolicyLink from "../../../components/PrivacyPolicyLink";
import { DurianHeader, ds } from "../../../components/DurianUI";
import { Button } from "../../../components/UI";
import { c, ui } from "../../../lib/theme";
import { logout } from "../../../lib/api";
import { useAuthStore } from "../../../store/authStore";

export default function DurianAccount() {
  const user = useAuthStore((state) => state.user);
  return (
    <View style={ds.page}>
      <DurianHeader title="Tài khoản" showAction={false} />
      <ScrollView contentContainerStyle={ds.content}>
        <View style={[ds.card, ui.row]}>
          <View style={[ui.iconButton, { backgroundColor: c.soft }]}>
            <Ionicons name="person-outline" color={c.navy} size={22} />
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <Text style={ui.muted}>Tên đăng nhập</Text>
            <Text selectable style={[ui.heading, { color: c.navy }]}>
              {user?.username || "—"}
            </Text>
            {user?.stationName ? (
              <Text style={ui.muted}>{user.stationName}</Text>
            ) : null}
          </View>
        </View>
        <SupportContacts />
        <PrivacyPolicyLink />
        <Button
          secondary
          icon="log-out-outline"
          title="Đăng xuất"
          onPress={() => void logout()}
        />
      </ScrollView>
    </View>
  );
}
