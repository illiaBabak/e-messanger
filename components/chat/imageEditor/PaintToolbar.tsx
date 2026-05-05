import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/theme";

import { BRUSH_SIZES, BrushSize, DrawingPath, PAINT_COLORS } from "./types";

type PaintToolbarProps = {
  selectedColor: string;
  selectedBrushSize: BrushSize;
  isEraserActive: boolean;
  paths: DrawingPath[];
  onColorChange: (color: string) => void;
  onBrushSizeChange: (size: BrushSize) => void;
  onEraserToggle: () => void;
  onUndo: () => void;
};

const BRUSH_SIZE_LABELS: Record<BrushSize, string> = {
  small: "S",
  medium: "M",
  large: "L",
};

const COLOR_CIRCLE_SIZE = 28;
const BRUSH_PREVIEW_SCALE = 2.5;

export const PaintToolbar = React.memo(({
  selectedColor,
  selectedBrushSize,
  isEraserActive,
  paths,
  onColorChange,
  onBrushSizeChange,
  onEraserToggle,
  onUndo,
}: PaintToolbarProps) => (
  <View style={styles.container}>
    {/* Colors row */}
    <View style={styles.colorsRow}>
      {PAINT_COLORS.map(color => {
        const isSelected = selectedColor === color && !isEraserActive;

        return (
          <Pressable
            key={color}
            style={[
              styles.colorCircle,
              { backgroundColor: color },
              isSelected && styles.colorCircleSelected,
              color === "#FFFFFF" && styles.colorCircleWhiteBorder,
              color === "#000000" && styles.colorCircleDarkBorder,
            ]}
            onPress={() => onColorChange(color)}
          />
        );
      })}
    </View>

    {/* Controls row: brush sizes + eraser + undo */}
    <View style={styles.controlsRow}>
      {/* Brush sizes */}
      <View style={styles.brushSizesContainer}>
        {(Object.keys(BRUSH_SIZES) as BrushSize[]).map(size => {
          const isSelected = selectedBrushSize === size;
          const previewDiameter = BRUSH_SIZES[size] * BRUSH_PREVIEW_SCALE;

          return (
            <Pressable
              key={size}
              style={[styles.brushButton, isSelected && styles.brushButtonActive]}
              onPress={() => onBrushSizeChange(size)}
            >
              <View
                style={[
                  styles.brushPreviewDot,
                  {
                    width: previewDiameter,
                    height: previewDiameter,
                    borderRadius: previewDiameter / 2,
                    backgroundColor: isSelected ? Colors.primary : "rgba(255,255,255,0.6)",
                  },
                ]}
              />
              <Text style={[styles.brushLabel, isSelected && styles.brushLabelActive]}>
                {BRUSH_SIZE_LABELS[size]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Separator */}
      <View style={styles.separator} />

      {/* Eraser */}
      <Pressable
        style={[styles.actionButton, isEraserActive && styles.actionButtonActive]}
        onPress={onEraserToggle}
      >
        <Ionicons
          name="backspace-outline"
          size={20}
          color={isEraserActive ? Colors.primary : "rgba(255,255,255,0.7)"}
        />
        <Text style={[styles.actionLabel, isEraserActive && styles.actionLabelActive]}>
          Eraser
        </Text>
      </Pressable>

      {/* Undo */}
      <Pressable
        style={[styles.actionButton, paths.length === 0 && styles.actionButtonDisabled]}
        onPress={onUndo}
        disabled={paths.length === 0}
      >
        <Ionicons
          name="arrow-undo"
          size={20}
          color={paths.length > 0 ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.25)"}
        />
        <Text
          style={[
            styles.actionLabel,
            paths.length === 0 && styles.actionLabelDisabled,
          ]}
        >
          Undo
        </Text>
      </Pressable>
    </View>
  </View>
));

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    gap: 12,
  },
  colorsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginHorizontal: 16,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 20,
  },
  colorCircle: {
    width: COLOR_CIRCLE_SIZE,
    height: COLOR_CIRCLE_SIZE,
    borderRadius: COLOR_CIRCLE_SIZE / 2,
  },
  colorCircleSelected: {
    borderWidth: 3,
    borderColor: Colors.primary,
    transform: [{ scale: 1.15 }],
  },
  colorCircleWhiteBorder: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  colorCircleDarkBorder: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 20,
  },
  brushSizesContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  brushButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
    minWidth: 40,
  },
  brushButtonActive: {
    backgroundColor: "rgba(74, 144, 255, 0.15)",
  },
  brushPreviewDot: {
    backgroundColor: "rgba(255,255,255,0.6)",
  },
  brushLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.5)",
    fontWeight: "600",
  },
  brushLabelActive: {
    color: Colors.primary,
  },
  separator: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginHorizontal: 4,
  },
  actionButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
    minWidth: 48,
  },
  actionButtonActive: {
    backgroundColor: "rgba(74, 144, 255, 0.15)",
  },
  actionButtonDisabled: {
    opacity: 0.4,
  },
  actionLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.5)",
    fontWeight: "500",
  },
  actionLabelActive: {
    color: Colors.primary,
  },
  actionLabelDisabled: {
    color: "rgba(255,255,255,0.25)",
  },
});
