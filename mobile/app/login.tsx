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
import { useAuthStore, type DatabaseSource } from "../store/authStore";
import { login, LoginConflict } from "../lib/api";
import { c, ui } from "../lib/theme";
import { Button, Field, State } from "../components/UI";
import { Segments } from "../components/BrowseUI";
import Brand from "../components/Brand";
import PrivacyPolicyLink from "../components/PrivacyPolicyLink";
export default function Login() {
  const user = useAuthStore((s) => s.user),
    ready = useAuthStore((s) => s.ready);
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [stationId, setStationId] = useState(""),
    [showStation, setShowStation] = useState(false),
    [sources, setSources] = useState<DatabaseSource[]>([]),
    [source, setSource] = useState<DatabaseSource | "auto">("auto"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (!ready)
    return (
      <View style={ui.screen}>
        <State loading />
      </View>
    );
  if (user)
    return (
      <Redirect
        href={
          user.stationType === "durian"
            ? "/durian"
            : user.stationType === "unknown"
              ? "/station-unavailable"
              : "/(tabs)/dashboard"
        }
      />
    );
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
        ...(source === "auto" ? {} : { source }),
        ...(showStation && stationId ? { stationId: Number(stationId) } : {}),
      });
    } catch (e) {
      if (e instanceof LoginConflict) {
        setShowStation(true);
        setSources(e.sources);
      }
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <KeyboardAvoidingView
      style={ui.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{
          flexGrow: 1,
          padding: 16,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <View
          style={[
            ui.card,
            { width: "100%", maxWidth: 430, gap: 22, padding: 22 },
          ]}
        >
          <View style={{ alignItems: "center", paddingVertical: 10 }}>
            <Brand width={210} />
          </View>
          <View style={{ gap: 8 }}>
            <Text accessibilityRole="header" style={ui.title}>
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
          {sources.length > 1 ? (
            <View style={{ gap: 6 }}>
              <Text style={ui.body}>Nguồn đăng nhập</Text>
              <Segments
                value={source}
                onChange={setSource}
                items={[
                  { value: "auto", label: "Tự nhận diện" },
                  ...sources.map((value) => ({ value, label: value === "db1" ? "Database 1" : "Database 2" })),
                ]}
              />
            </View>
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
