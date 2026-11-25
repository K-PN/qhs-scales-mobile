import { useEffect } from "react";
import { Stack } from "expo-router";
import { focusManager, QueryClientProvider } from "@tanstack/react-query";
import { AppState, Platform } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { api, queryClient } from "../lib/api";
import type { AuthUser } from "../store/authStore";
import { useAuthStore } from "../store/authStore";
import { c } from "../lib/theme";
export default function RootLayout() {
  const hydrate = useAuthStore((s) => s.hydrate);
  useEffect(() => {
    void (async () => {
      await hydrate();
      const initial = useAuthStore.getState();
      if (!initial.user || !initial.refreshToken || !initial.accessToken) return;
      if (initial.user.stationType && (initial.user.role !== "admin" || initial.user.databaseSources)) return;
      try {
        const { user } = await api<{ user: AuthUser }>("/auth/me");
        const session = useAuthStore.getState();
        if (session.refreshToken !== initial.refreshToken || !session.accessToken) return;
        await session.setAuth({ user, accessToken: session.accessToken, refreshToken: initial.refreshToken });
      } catch {
        // The current route can retry once connectivity returns.
      }
    })();
    if (Platform.OS === "web") return;
    const subscription = AppState.addEventListener("change", (state) => focusManager.setFocused(state === "active"));
    return () => subscription.remove();
  }, [hydrate]);
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <SafeAreaView
          style={{ flex: 1, backgroundColor: c.white }}
          edges={["top", "left", "right"]}
        >
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }} />
        </SafeAreaView>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
