// Smoke check only. Never prints tokens or uses a bundled password.
(async () => {
  const username = process.env.QHS_LOGIN_USERNAME,
    password = process.env.QHS_LOGIN_PASSWORD;
  if (!username || !password)
    throw new Error("Set QHS_LOGIN_USERNAME and QHS_LOGIN_PASSWORD.");
  const res = await fetch(
    (process.env.QHS_API_URL || "http://localhost:4010") + "/auth/login",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        password,
        ...(process.env.QHS_STATION_ID
          ? { stationId: Number(process.env.QHS_STATION_ID) }
          : {}),
      }),
    },
  );
  const data = await res.json();
  console.log("HTTP", res.status);
  if (!res.ok) throw new Error(data.message);
  console.log("Authenticated role:", data.user.role);
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
