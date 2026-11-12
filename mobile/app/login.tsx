import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
  Pressable,
  Keyboard,
} from "react-native";
import { Redirect } from "expo-router";
import { useAuthStore } from "../store/authStore";
import { login, ApiError } from "../lib/api";
import { c, ui } from "../lib/theme";
import { Button, Field, State } from "../components/UI";
import Brand from "../components/Brand";
import PrivacyPolicyLink from "../components/PrivacyPolicyLink";
export default function Login() {
  const user = useAuthStore((s) => s.user),
    ready = useAuthStore((s) => s.ready);
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [stationId, setStationId] = useState(""),
    [showStation, setShowStation] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (!ready)
    return (
      <View style={ui.screen}>
        <State loading />
      </View>
    );
  if (user) return <Redirect href="/(tabs)/dashboard" />;
  async function submit() {
    if (busy) return;
    setError("");
    if (!username.trim() || !password) {
      setError("Vui lòng nhập tài khoản và mật khẩu.");
      return;
    }
    if (showStation && stationId && !/^[1-9]\d*$/.test(stationId)) {
      setError("Mã trạm không hợp lệ.");
      return;
    }
    Keyboard.dismiss();
    setBusy(true);
    try {
      await login({
        username: username.trim(),
        password,
        ...(showStation && stationId ? { stationId: Number(stationId) } : {}),
      });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setShowStation(true);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.white }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{
          flexGrow: 1,
          padding: 28,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <View style={{ width: "100%", maxWidth: 400, gap: 28 }}>
          <View style={{ alignItems: "center", paddingVertical: 24 }}>
            <Brand width={270} />
          </View>
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 30, fontWeight: "800", color: c.text }}>
              Đăng nhập
            </Text>
            <View
              style={{
                width: 44,
                height: 4,
                borderRadius: 2,
                backgroundColor: c.yellow,
              }}
            />
          </View>
          <Field
            label="Tài khoản"
            value={username}
            onChange={setUsername}
            placeholder="Tên đăng nhập"
          />
          <Field
            label="Mật khẩu"
            value={password}
            onChange={setPassword}
            secret
            placeholder="Nhập mật khẩu"
            onSubmit={() => void submit()}
          />
          {showStation ? (
            <Field
              label="Mã trạm"
              value={stationId}
              onChange={setStationId}
              numeric
            />
          ) : null}
          {error ? (
            <Text accessibilityRole="alert" style={ui.error}>
              {error}
            </Text>
          ) : null}
          <Button title="Đăng nhập" onPress={() => void submit()} busy={busy} />
          <PrivacyPolicyLink />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
