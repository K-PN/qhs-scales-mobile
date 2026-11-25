const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const source = path.join(root, "mobile");
const target = path.join(root, "release", "store-20261023");
if (fs.existsSync(target))
  throw new Error(
    "Release workspace already exists. Preserve its changes; do not overwrite it.",
  );
fs.mkdirSync(target, { recursive: true });
function copySource(from, to) {
  if (fs.statSync(from).isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const name of fs.readdirSync(from))
      copySource(path.join(from, name), path.join(to, name));
  } else {
    fs.writeFileSync(to, fs.readFileSync(from));
  }
}
for (const name of [
  "app",
  "components",
  "content",
  "lib",
  "store",
  "assets",
  "tsconfig.json",
]) {
  copySource(path.join(source, name), path.join(target, name));
}
const pkg = JSON.parse(
  fs.readFileSync(path.join(source, "package.json"), "utf8"),
);
pkg.engines = { node: ">=22.13.0" };
Object.assign(pkg.dependencies, {
  expo: "~54.0.38",
  "@expo/vector-icons": "^15.0.3",
  "@react-native-async-storage/async-storage": "2.2.0",
  "expo-constants": "~18.0.14",
  "expo-linear-gradient": "~15.0.8",
  "expo-router": "~6.0.24",
  "expo-secure-store": "~15.0.8",
  "expo-status-bar": "~3.0.9",
  "expo-font": "~14.0.12",
  "expo-linking": "~8.0.12",
  "expo-system-ui": "~6.0.9",
  "expo-splash-screen": "~31.0.13",
  "expo-build-properties": "~1.0.10",
  "expo-dev-client": "~6.0.21",
  react: "19.1.0",
  "react-dom": "19.1.0",
  "react-native": "0.81.5",
  "react-native-safe-area-context": "~5.6.0",
  "react-native-screens": "~4.16.0",
  "react-native-svg": "15.12.1",
  "react-native-web": "~0.21.0",
});
pkg.devDependencies["@types/react"] = "~19.1.10";
pkg.devDependencies.typescript = "~5.9.2";
const app = JSON.parse(fs.readFileSync(path.join(source, "app.json"), "utf8"));
app.expo.newArchEnabled = true;
app.expo.android.edgeToEdgeEnabled = true;
app.expo.android.blockedPermissions = [
  "android.permission.RECORD_AUDIO",
  "android.permission.READ_EXTERNAL_STORAGE",
  "android.permission.WRITE_EXTERNAL_STORAGE",
];
delete app.expo.splash;
app.expo.plugins = [
  "expo-router",
  "expo-secure-store",
  [
    "expo-splash-screen",
    {
      image: "./assets/splash-logo.png",
      imageWidth: 240,
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
  ],
  [
    "expo-build-properties",
    {
      android: { compileSdkVersion: 36, targetSdkVersion: 36 },
      ios: { deploymentTarget: "15.1" },
    },
  ],
];
const eas = {
  cli: { version: ">= 25.3.0", appVersionSource: "remote" },
  build: {
    development: { developmentClient: true, distribution: "internal" },
    preview: {
      distribution: "internal",
      android: { buildType: "apk" },
      ios: { simulator: false },
    },
    production: {
      distribution: "store",
      environment: "production",
      autoIncrement: true,
      node: "22.23.3",
      env: { QHS_STORE_BUILD: "1" },
      android: {
        buildType: "app-bundle",
        image: "ubuntu-24.04-jdk-17-ndk-r27b",
      },
      ios: { simulator: false, image: "macos-sequoia-15.6-xcode-26.0" },
    },
  },
  submit: { production: {} },
};
for (const [name, data] of Object.entries({
  "package.json": pkg,
  "app.json": app,
  "eas.json": eas,
})) {
  fs.writeFileSync(
    path.join(target, name),
    JSON.stringify(data, null, 2) + "\n",
  );
}
fs.copyFileSync(path.join(__dirname, "store-package-lock.json"), path.join(target, "package-lock.json"));
fs.writeFileSync(
  path.join(target, "app.config.js"),
  `module.exports = ({ config }) => {
  const buildNumber = process.env.QHS_IOS_BUILD_NUMBER;
  if (buildNumber) {
    if (!/^[1-9]\\d*$/.test(buildNumber)) throw new Error('Invalid iOS build number.');
    config.ios = { ...config.ios, buildNumber };
  }
  if (process.env.QHS_STORE_BUILD === '1') {
    const raw = process.env.EXPO_PUBLIC_API_URL;
    let url;
    try { url = new URL(raw); } catch { throw new Error('Set EXPO_PUBLIC_API_URL to the production HTTPS API before building for stores.'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || /^(localhost|127\\.|10\\.|192\\.168\\.|0\\.|\\[::1\\])/.test(url.hostname)) {
      throw new Error('Store builds require a public HTTPS API URL without credentials, queries or fragments.');
    }
  }
  return config;
};
`,
);
fs.writeFileSync(
  path.join(target, ".gitignore"),
  "node_modules/\n.expo/\n.env*\n!.env.example\nbuild-artifacts/\nios/\nandroid/\n",
);
fs.writeFileSync(
  path.join(target, ".easignore"),
  "node_modules/\n.expo/\n.git/\n.env*\n!.env.example\nbuild-artifacts/\n*.log\nios/\nandroid/\n",
);
fs.writeFileSync(
  path.join(target, ".env.example"),
  "# Public API base URL. Configure the real production HTTPS API in EAS environment production.\nEXPO_PUBLIC_API_URL=\n",
);
console.log("Prepared isolated store workspace: " + target);
