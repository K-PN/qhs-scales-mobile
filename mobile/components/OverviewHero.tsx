import { useState, type ReactNode } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { c, ui } from "../lib/theme";

const heroScenes = require("../assets/overview-scenes.png");

function HeroScene({ scene }: { scene: "truck" | "durian" }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const panelWidth = Math.max(size.width, size.height * 1.5);
  const height = panelWidth / 1.5;
  return (
    <View
      pointerEvents="none"
      onLayout={({
        nativeEvent: {
          layout: { width, height },
        },
      }) => {
        setSize((previous) =>
          width === previous.width && height === previous.height
            ? previous
            : { width, height },
        );
      }}
      style={{
        position: "absolute",
        right: 0,
        top: 0,
        bottom: 0,
        width: "64%",
        overflow: "hidden",
      }}
    >
      {size.width > 0 ? (
        <Image
          accessible={false}
          source={heroScenes}
          resizeMode="stretch"
          style={{
            position: "absolute",
            width: panelWidth * 2,
            height,
            top: (size.height - height) / 2,
            left:
              (size.width - panelWidth) * (scene === "truck" ? 0.8 : 0.66) -
              (scene === "durian" ? panelWidth : 0),
          }}
        />
      ) : null}
    </View>
  );
}

export default function OverviewHero({
  label,
  value,
  unit,
  scene,
  icon,
  children,
}: {
  label?: string;
  value?: string;
  unit?: string;
  scene?: "truck" | "durian";
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  children?: ReactNode;
}) {
  return (
    <View
      style={[
        ui.card,
        {
          backgroundColor: c.hero,
          borderColor: c.navy,
          padding: 18,
          gap: 8,
          overflow: "hidden",
        },
      ]}
    >
      {scene ? (
        <>
          <HeroScene scene={scene} />
          <LinearGradient
            pointerEvents="none"
            colors={[
              c.hero,
              c.hero,
              "rgba(9,62,51,0.82)",
              "rgba(9,62,51,0.26)",
            ]}
            locations={[0, 0.38, 0.62, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </>
      ) : (
        <LinearGradient
          pointerEvents="none"
          colors={[c.hero, c.navy]}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      {label ? (
        <View style={[ui.row, { gap: 7 }]}>
          {icon ? <Ionicons name={icon} color={c.yellow} size={19} /> : null}
          <Text
            style={{
              color: c.onHero,
              fontSize: 14,
              fontWeight: "700",
              flexShrink: 1,
            }}
          >
            {label}
          </Text>
        </View>
      ) : null}
      {value !== undefined ? (
        <Text
          style={{
            color: c.white,
            fontSize: 39,
            fontWeight: "800",
            fontVariant: ["tabular-nums"],
          }}
        >
          {value}
          {unit ? (
            <Text style={{ fontSize: 19, color: c.onHero }}> {unit}</Text>
          ) : null}
        </Text>
      ) : null}
      {children ? (
        <View
          style={[
            {
              gap: 8,
              borderTopWidth: label ? 1 : 0,
              borderTopColor: "rgba(216,241,232,0.35)",
              paddingTop: label ? 8 : 0,
            },
            scene && {
              padding: 8,
              borderTopWidth: 0,
              borderRadius: 12,
              backgroundColor: "rgba(6,43,34,0.87)",
            },
          ]}
        >
          {children}
        </View>
      ) : null}
    </View>
  );
}
