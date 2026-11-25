import { Redirect } from "expo-router";
import { Text, View } from "react-native";
import { Button, State } from "../components/UI";
import { logout } from "../lib/api";
import { ui } from "../lib/theme";
import { useAuthStore } from "../store/authStore";

export default function StationUnavailable() {
  const { ready, user } = useAuthStore();
  if (!ready) return <State loading />;
  if (!user || user.stationType !== "unknown")
    return <Redirect href="/login" />;
  return (
    <View style={{ padding: 20, gap: 16 }}>
      <Text style={ui.heading}>Chưa xác định loại trạm</Text>
      <Text style={ui.body}>
        Liên hệ Quốc Hưng để kiểm tra cấu hình của trạm{" "}
        {user.stationName || user.stationId}.
      </Text>
      <Button title="Đăng xuất" onPress={() => void logout()} />
    </View>
  );
}
