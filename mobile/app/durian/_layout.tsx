import { Redirect, Stack } from "expo-router";
import { State } from "../../components/UI";
import { useAuthStore } from "../../store/authStore";

export default function DurianLayout() {
  const { user, ready } = useAuthStore();
  if (!ready) return <State loading />;
  if (!user || user.stationType !== "durian") return <Redirect href="/login" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
