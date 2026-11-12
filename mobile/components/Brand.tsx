import { Image, View } from "react-native";
export default function Brand({ width = 190 }: { width?: number }) {
  return (
    <View
      style={{
        backgroundColor: "white",
        borderRadius: 12,
        padding: 8,
        alignSelf: "flex-start",
      }}
    >
      <Image
        source={require("../assets/logo.png")}
        accessibilityLabel="Cân điện tử Quốc Hưng"
        resizeMode="contain"
        style={{ width, height: (width * 636) / 2048 }}
      />
    </View>
  );
}
