const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const stage = path.join(root, "release", "store-20261023");

async function main() {
  const easPath = path.join(stage, "eas.json");
  if (!fs.existsSync(easPath))
    throw new Error("Run npm run store:prepare first.");
  const eas = JSON.parse(fs.readFileSync(easPath, "utf8"));
  const api =
    process.env.EXPO_PUBLIC_API_URL ||
    eas.build.production.env.EXPO_PUBLIC_API_URL;
  if (!api)
    throw new Error(
      "Missing production API. Set EXPO_PUBLIC_API_URL to the real public HTTPS backend before submitting a build.",
    );
  const url = new URL(api);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[::1\])/.test(
      url.hostname,
    ) ||
    /\.(local|localhost)$/.test(url.hostname)
  ) {
    throw new Error(
      "Use a public HTTPS API without credentials, query parameters, or fragments.",
    );
  }
  const base = api.replace(/\/$/, "");
  const health = await fetch(base + "/health", {
    signal: AbortSignal.timeout(15000),
  });
  const body = await health.json();
  if (!health.ok || body.appReady !== true)
    throw new Error("Production API health/readiness check failed.");
  eas.build.production.env.EXPO_PUBLIC_API_URL = base;
  fs.writeFileSync(easPath, JSON.stringify(eas, null, 2) + "\n");
  console.log("Production API verified: " + url.host);
  // No VCS metadata exists in this workspace. Upload only the isolated mobile project.
  const command =
    "npx --yes --package=node@22 --package=eas-cli@25.3.0 eas build --platform all --profile production --non-interactive --no-wait";
  const result = spawnSync("cmd.exe", ["/d", "/s", "/c", command], {
    cwd: stage,
    stdio: "inherit",
    windowsHide: true,
    env: { ...process.env, EAS_NO_VCS: "1" },
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
