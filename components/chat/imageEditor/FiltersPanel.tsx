import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { Colors } from "@/constants/theme";

import {
  DEFAULT_FILTER_VALUES,
  FILTER_SLIDER_CONFIGS,
  FilterKey,
  ImageFilterValues,
} from "./types";

type FiltersPanelProps = {
  values: ImageFilterValues;
  onValueChange: (key: FilterKey, value: number) => void;
  onReset: () => void;
};

const SLIDER_WIDTH = 200;
const SLIDER_TRACK_HEIGHT = 4;
const SLIDER_THUMB_SIZE = 22;
const SLIDER_HIT_HEIGHT = 40;

const SPRING_CONFIG = {
  stiffness: 1000,
  damping: 500,
  mass: 3,
  overshootClamping: true,
  restDisplacementThreshold: 0.01,
  restSpeedThreshold: 0.01,
};

/** High-performance custom slider using Reanimated and Gesture Handler */
const FilterSlider = React.memo(
  ({
    label,
    value,
    min,
    max,
    onValueChange,
  }: {
    label: string;
    value: number;
    min: number;
    max: number;
    onValueChange: (v: number) => void;
  }) => {
    const translationX = useSharedValue(((value - min) / (max - min)) * SLIDER_WIDTH);
    const midPoint = (0 - min) / (max - min);

    const lastReportedValue = useSharedValue(value);

    // Sync shared value when prop value changes (e.g. on Reset)
    useEffect(() => {
      const target = ((value - min) / (max - min)) * SLIDER_WIDTH;
      lastReportedValue.value = value;
      if (Math.abs(translationX.value - target) > 1) {
        translationX.value = withSpring(target, SPRING_CONFIG);
      }
    }, [value, min, max, translationX, lastReportedValue]);

    const gesture = useMemo(
      () =>
        Gesture.Pan()
          .activeOffsetX([-5, 5])
          .onUpdate(event => {
            const clamped = Math.max(0, Math.min(event.x, SLIDER_WIDTH));
            translationX.value = clamped;

            const normalized = clamped / SLIDER_WIDTH;
            const rawValue = min + normalized * (max - min);
            const stepped = Math.round(rawValue);
            
            if (stepped !== lastReportedValue.value) {
              lastReportedValue.value = stepped;
              runOnJS(onValueChange)(stepped);
            }
          }),
      [min, max, onValueChange, translationX, lastReportedValue],
    );

    const tapGesture = useMemo(
      () =>
        Gesture.Tap().onEnd(event => {
          const clamped = Math.max(0, Math.min(event.x, SLIDER_WIDTH));
          translationX.value = withSpring(clamped, SPRING_CONFIG);

          const normalized = clamped / SLIDER_WIDTH;
          const rawValue = min + normalized * (max - min);
          const stepped = Math.round(rawValue);
          
          if (stepped !== lastReportedValue.value) {
            lastReportedValue.value = stepped;
            runOnJS(onValueChange)(stepped);
          }
        }),
      [min, max, onValueChange, translationX, lastReportedValue],
    );

    const thumbStyle = useAnimatedStyle(() => ({
      transform: [{ translateX: translationX.value - SLIDER_THUMB_SIZE / 2 }],
    }));

    const fillStyle = useAnimatedStyle(() => {
      const normalizedPosition = translationX.value / SLIDER_WIDTH;
      const left = Math.min(midPoint, normalizedPosition) * SLIDER_WIDTH;
      const width = Math.abs(normalizedPosition - midPoint) * SLIDER_WIDTH;
      return {
        left,
        width,
      };
    });

    return (
      <View style={sliderStyles.container}>
        <View style={sliderStyles.labelRow}>
          <Text style={sliderStyles.label}>{label}</Text>
          <Text style={[sliderStyles.valueText, value !== 0 && sliderStyles.valueTextActive]}>
            {value > 0 ? `+${value}` : value}
          </Text>
        </View>
        <GestureDetector gesture={Gesture.Exclusive(gesture, tapGesture)}>
          <View style={sliderStyles.touchArea}>
            <View style={sliderStyles.track}>
              <Animated.View style={[sliderStyles.fill, fillStyle]} />
              <View style={[sliderStyles.centerTick, { left: midPoint * SLIDER_WIDTH - 1 }]} />
            </View>
            <Animated.View style={[sliderStyles.thumb, thumbStyle]} />
          </View>
        </GestureDetector>
      </View>
    );
  },
);

export const FiltersPanel = React.memo(({ values, onValueChange, onReset }: FiltersPanelProps) => {
  const hasChanges = Object.keys(values).some(
    key => values[key as FilterKey] !== DEFAULT_FILTER_VALUES[key as FilterKey],
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Adjust</Text>
        {hasChanges && (
          <Pressable style={styles.resetButton} onPress={onReset}>
            <Ionicons name="refresh" size={16} color={Colors.primary} />
            <Text style={styles.resetText}>Reset</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.slidersContent}
      >
        {FILTER_SLIDER_CONFIGS.map(config => (
          <FilterSlider
            key={config.key}
            label={config.label}
            value={values[config.key]}
            min={config.min}
            max={config.max}
            onValueChange={v => onValueChange(config.key, v)}
          />
        ))}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    maxHeight: 160,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "rgba(255,255,255,0.9)",
  },
  resetButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  resetText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: "600",
  },
  slidersContent: {
    paddingHorizontal: 20,
    gap: 4,
    paddingBottom: 8,
  },
});

const sliderStyles = StyleSheet.create({
  container: {
    paddingVertical: 6,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "500",
  },
  valueText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.4)",
    fontWeight: "500",
    minWidth: 36,
    textAlign: "right",
  },
  valueTextActive: {
    color: Colors.primary,
  },
  touchArea: {
    height: SLIDER_HIT_HEIGHT,
    width: SLIDER_WIDTH,
    justifyContent: "center",
    alignSelf: "center",
  },
  track: {
    height: SLIDER_TRACK_HEIGHT,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: SLIDER_TRACK_HEIGHT / 2,
    width: SLIDER_WIDTH,
  },
  fill: {
    position: "absolute",
    height: SLIDER_TRACK_HEIGHT,
    backgroundColor: Colors.primary,
    borderRadius: SLIDER_TRACK_HEIGHT / 2,
  },
  centerTick: {
    position: "absolute",
    width: 2,
    height: SLIDER_TRACK_HEIGHT + 6,
    top: -3,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 1,
  },
  thumb: {
    position: "absolute",
    width: SLIDER_THUMB_SIZE,
    height: SLIDER_THUMB_SIZE,
    borderRadius: SLIDER_THUMB_SIZE / 2,
    backgroundColor: Colors.white,
    top: (SLIDER_HIT_HEIGHT - SLIDER_THUMB_SIZE) / 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
});
