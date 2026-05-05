import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/theme";

import { EditorMode } from "./types";

type EditorToolbarProps = {
  activeMode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
};

type ToolConfig = {
  mode: EditorMode;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
};

const TOOLS: ToolConfig[] = [
  { mode: "crop", icon: "crop", label: "Crop" },
  { mode: "paint", icon: "brush", label: "Paint" },
  { mode: "filters", icon: "options", label: "Filters" },
];

export const EditorToolbar = ({ activeMode, onModeChange }: EditorToolbarProps) => {
  const handlePress = (mode: EditorMode) => {
    onModeChange(activeMode === mode ? "none" : mode);
  };

  return (
    <View style={styles.container}>
      {TOOLS.map(({ mode, icon, label }) => {
        const isActive = activeMode === mode;

        return (
          <Pressable
            key={mode}
            style={[styles.toolButton, isActive && styles.toolButtonActive]}
            onPress={() => handlePress(mode)}
          >
            <Ionicons
              name={icon}
              size={24}
              color={isActive ? Colors.primary : "rgba(255,255,255,0.7)"}
            />
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
    paddingVertical: 8,
  },
  toolButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  toolButtonActive: {
    backgroundColor: "rgba(74, 144, 255, 0.15)",
  },
});
