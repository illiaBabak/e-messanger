import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

import { Colors } from "@/constants/theme";
import { CropRegion } from "./types";

type CropOverlayProps = {
  imageLayout: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  translateY: number;
  onApply: (region: CropRegion) => void;
  onCancel: () => void;
};

const HANDLE_SIZE = 28;
const HANDLE_HIT_SLOP = 24; // Extra tap area for fingers
const MIN_CROP_SIZE = 50;
const GRID_LINES = 2;

export const CropOverlay = ({ imageLayout, translateY, onApply, onCancel }: CropOverlayProps) => {
  // Shared values for 60fps UI thread animation
  const x = useSharedValue(imageLayout.x + imageLayout.width * 0.1);
  const y = useSharedValue(imageLayout.y + imageLayout.height * 0.1);
  const w = useSharedValue(imageLayout.width * 0.8);
  const h = useSharedValue(imageLayout.height * 0.8);

  // Temporary values during drag
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startW = useSharedValue(0);
  const startH = useSharedValue(0);

  // Sync if image layout changes
  useEffect(() => {
    x.value = imageLayout.x + imageLayout.width * 0.1;
    y.value = imageLayout.y + imageLayout.height * 0.1;
    w.value = imageLayout.width * 0.8;
    h.value = imageLayout.height * 0.8;
  }, [imageLayout, x, y, w, h]);

  // Gestures
  const moveGesture = Gesture.Pan()
    .onBegin(() => {
      startX.value = x.value;
      startY.value = y.value;
    })
    .onUpdate((e) => {
      const imgRight = imageLayout.x + imageLayout.width;
      const imgBottom = imageLayout.y + imageLayout.height;

      x.value = Math.max(imageLayout.x, Math.min(startX.value + e.translationX, imgRight - w.value));
      y.value = Math.max(imageLayout.y, Math.min(startY.value + e.translationY, imgBottom - h.value));
    });

  const tlGesture = Gesture.Pan()
    .hitSlop(HANDLE_HIT_SLOP)
    .onBegin(() => {
      startX.value = x.value;
      startY.value = y.value;
      startW.value = w.value;
      startH.value = h.value;
    })
    .onUpdate((e) => {
      const newX = Math.max(imageLayout.x, Math.min(startX.value + e.translationX, startX.value + startW.value - MIN_CROP_SIZE));
      const newY = Math.max(imageLayout.y, Math.min(startY.value + e.translationY, startY.value + startH.value - MIN_CROP_SIZE));
      
      x.value = newX;
      y.value = newY;
      w.value = startX.value + startW.value - newX;
      h.value = startY.value + startH.value - newY;
    });

  const trGesture = Gesture.Pan()
    .hitSlop(HANDLE_HIT_SLOP)
    .onBegin(() => {
      startX.value = x.value;
      startY.value = y.value;
      startW.value = w.value;
      startH.value = h.value;
    })
    .onUpdate((e) => {
      const imgRight = imageLayout.x + imageLayout.width;
      
      const newW = Math.max(MIN_CROP_SIZE, Math.min(startW.value + e.translationX, imgRight - startX.value));
      const newY = Math.max(imageLayout.y, Math.min(startY.value + e.translationY, startY.value + startH.value - MIN_CROP_SIZE));
      
      y.value = newY;
      w.value = newW;
      h.value = startY.value + startH.value - newY;
    });

  const blGesture = Gesture.Pan()
    .hitSlop(HANDLE_HIT_SLOP)
    .onBegin(() => {
      startX.value = x.value;
      startY.value = y.value;
      startW.value = w.value;
      startH.value = h.value;
    })
    .onUpdate((e) => {
      const imgBottom = imageLayout.y + imageLayout.height;
      
      const newX = Math.max(imageLayout.x, Math.min(startX.value + e.translationX, startX.value + startW.value - MIN_CROP_SIZE));
      const newH = Math.max(MIN_CROP_SIZE, Math.min(startH.value + e.translationY, imgBottom - startY.value));
      
      x.value = newX;
      w.value = startX.value + startW.value - newX;
      h.value = newH;
    });

  const brGesture = Gesture.Pan()
    .hitSlop(HANDLE_HIT_SLOP)
    .onBegin(() => {
      startX.value = x.value;
      startY.value = y.value;
      startW.value = w.value;
      startH.value = h.value;
    })
    .onUpdate((e) => {
      const imgRight = imageLayout.x + imageLayout.width;
      const imgBottom = imageLayout.y + imageLayout.height;
      
      const newW = Math.max(MIN_CROP_SIZE, Math.min(startW.value + e.translationX, imgRight - startX.value));
      const newH = Math.max(MIN_CROP_SIZE, Math.min(startH.value + e.translationY, imgBottom - startY.value));
      
      w.value = newW;
      h.value = newH;
    });

  // Animated Styles
  const borderStyle = useAnimatedStyle(() => ({
    left: x.value,
    top: y.value,
    width: w.value,
    height: h.value,
  }));

  const tlStyle = useAnimatedStyle(() => ({
    left: x.value - HANDLE_SIZE / 2,
    top: y.value - HANDLE_SIZE / 2,
  }));
  const trStyle = useAnimatedStyle(() => ({
    left: x.value + w.value - HANDLE_SIZE / 2,
    top: y.value - HANDLE_SIZE / 2,
  }));
  const blStyle = useAnimatedStyle(() => ({
    left: x.value - HANDLE_SIZE / 2,
    top: y.value + h.value - HANDLE_SIZE / 2,
  }));
  const brStyle = useAnimatedStyle(() => ({
    left: x.value + w.value - HANDLE_SIZE / 2,
    top: y.value + h.value - HANDLE_SIZE / 2,
  }));

  const dimTopStyle = useAnimatedStyle(() => ({
    top: 0,
    left: 0,
    right: 0,
    height: y.value,
  }));
  const dimBottomStyle = useAnimatedStyle(() => ({
    top: y.value + h.value,
    left: 0,
    right: 0,
    bottom: 0,
  }));
  const dimLeftStyle = useAnimatedStyle(() => ({
    top: y.value,
    left: 0,
    width: x.value,
    height: h.value,
  }));
  const dimRightStyle = useAnimatedStyle(() => ({
    top: y.value,
    left: x.value + w.value,
    right: 0,
    height: h.value,
  }));

  const handleApply = useCallback(() => {
    const region: CropRegion = {
      originX: (x.value - imageLayout.x) / imageLayout.width,
      originY: (y.value - imageLayout.y) / imageLayout.height,
      width: w.value / imageLayout.width,
      height: h.value / imageLayout.height,
    };
    onApply(region);
  }, [imageLayout, onApply, x, y, w, h]);

  return (
    <GestureHandlerRootView style={StyleSheet.absoluteFill}>
      {/* Dimmed areas */}
      <Animated.View pointerEvents="none" style={[styles.dimOverlay, dimTopStyle]} />
      <Animated.View pointerEvents="none" style={[styles.dimOverlay, dimBottomStyle]} />
      <Animated.View pointerEvents="none" style={[styles.dimOverlay, dimLeftStyle]} />
      <Animated.View pointerEvents="none" style={[styles.dimOverlay, dimRightStyle]} />

      {/* Crop border (center drag) */}
      <GestureDetector gesture={moveGesture}>
        <Animated.View style={[styles.cropBorder, borderStyle]}>
          {Array.from({ length: GRID_LINES }).map((_, i) => (
            <View key={`h-${i}`} style={[styles.gridLineH, { top: `${((i + 1) / (GRID_LINES + 1)) * 100}%` }]} />
          ))}
          {Array.from({ length: GRID_LINES }).map((_, i) => (
            <View key={`v-${i}`} style={[styles.gridLineV, { left: `${((i + 1) / (GRID_LINES + 1)) * 100}%` }]} />
          ))}
        </Animated.View>
      </GestureDetector>

      {/* Corner Handles */}
      <GestureDetector gesture={tlGesture}>
        <Animated.View style={[styles.handle, tlStyle]}>
          <View style={[styles.handleCorner, styles.handleTL]} />
        </Animated.View>
      </GestureDetector>
      
      <GestureDetector gesture={trGesture}>
        <Animated.View style={[styles.handle, trStyle]}>
          <View style={[styles.handleCorner, styles.handleTR]} />
        </Animated.View>
      </GestureDetector>

      <GestureDetector gesture={blGesture}>
        <Animated.View style={[styles.handle, blStyle]}>
          <View style={[styles.handleCorner, styles.handleBL]} />
        </Animated.View>
      </GestureDetector>

      <GestureDetector gesture={brGesture}>
        <Animated.View style={[styles.handle, brStyle]}>
          <View style={[styles.handleCorner, styles.handleBR]} />
        </Animated.View>
      </GestureDetector>

      {/* Action buttons */}
      <View style={[styles.actionsRow, { bottom: -54 + translateY }]}>
        <Pressable style={styles.cancelButton} onPress={onCancel}>
          <Ionicons name="close" size={20} color={Colors.white} />
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable style={styles.applyButton} onPress={handleApply}>
          <Ionicons name="checkmark" size={20} color={Colors.white} />
          <Text style={styles.applyText}>Apply</Text>
        </Pressable>
      </View>
    </GestureHandlerRootView>
  );
};

const HANDLE_CORNER_LENGTH = 16;
const HANDLE_CORNER_WIDTH = 3;

const styles = StyleSheet.create({
  dimOverlay: {
    position: "absolute",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  cropBorder: {
    position: "absolute",
    borderWidth: 1.5,
    borderColor: Colors.white,
  },
  gridLineH: {
    position: "absolute",
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  gridLineV: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  handle: {
    position: "absolute",
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
  },
  handleCorner: {
    position: "absolute",
  },
  handleTL: {
    top: HANDLE_SIZE / 2 - HANDLE_CORNER_WIDTH / 2,
    left: HANDLE_SIZE / 2 - HANDLE_CORNER_WIDTH / 2,
    width: HANDLE_CORNER_LENGTH,
    height: HANDLE_CORNER_LENGTH,
    borderTopWidth: HANDLE_CORNER_WIDTH,
    borderLeftWidth: HANDLE_CORNER_WIDTH,
    borderColor: Colors.white,
  },
  handleTR: {
    top: HANDLE_SIZE / 2 - HANDLE_CORNER_WIDTH / 2,
    right: HANDLE_SIZE / 2 - HANDLE_CORNER_WIDTH / 2,
    width: HANDLE_CORNER_LENGTH,
    height: HANDLE_CORNER_LENGTH,
    borderTopWidth: HANDLE_CORNER_WIDTH,
    borderRightWidth: HANDLE_CORNER_WIDTH,
    borderColor: Colors.white,
  },
  handleBL: {
    bottom: HANDLE_SIZE / 2 - HANDLE_CORNER_WIDTH / 2,
    left: HANDLE_SIZE / 2 - HANDLE_CORNER_WIDTH / 2,
    width: HANDLE_CORNER_LENGTH,
    height: HANDLE_CORNER_LENGTH,
    borderBottomWidth: HANDLE_CORNER_WIDTH,
    borderLeftWidth: HANDLE_CORNER_WIDTH,
    borderColor: Colors.white,
  },
  handleBR: {
    bottom: HANDLE_SIZE / 2 - HANDLE_CORNER_WIDTH / 2,
    right: HANDLE_SIZE / 2 - HANDLE_CORNER_WIDTH / 2,
    width: HANDLE_CORNER_LENGTH,
    height: HANDLE_CORNER_LENGTH,
    borderBottomWidth: HANDLE_CORNER_WIDTH,
    borderRightWidth: HANDLE_CORNER_WIDTH,
    borderColor: Colors.white,
  },
  actionsRow: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
  },
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  cancelText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: "600",
  },
  applyButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  applyText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: "600",
  },
});
