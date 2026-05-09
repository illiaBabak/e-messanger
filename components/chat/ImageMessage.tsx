import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import React, { useRef } from "react";
import { ActivityIndicator, Dimensions, Pressable, StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/theme";

const { width } = Dimensions.get("window");
const IMAGE_MAX_WIDTH = width * 0.55; // 55% of screen width

export type ImageMessageProps = {
  url: string;
  isMe: boolean;
  timeStr: string;
  status?: "sending" | "sent" | "error" | "read";
  isRead?: boolean;
  onPress: () => void;
  onLongPress: (layout: { x: number; y: number; width: number; height: number }) => void;
};

export const ImageMessage = ({
  url,
  isMe,
  timeStr,
  status,
  isRead,
  onPress,
  onLongPress,
}: ImageMessageProps) => {
  const containerRef = useRef<View>(null);

  const handleLongPress = () => {
    containerRef.current?.measure((_x, _y, measuredWidth, measuredHeight, pageX, pageY) => {
      onLongPress({ x: pageX, y: pageY, width: measuredWidth, height: measuredHeight });
    });
  };

  return (
    <View ref={containerRef} collapsable={false}>
      <Pressable
        onPress={onPress}
        onLongPress={handleLongPress}
        delayLongPress={250}
        style={[styles.container, isMe ? styles.containerMe : styles.containerFriend]}
      >
        <Image source={url} style={styles.image} contentFit="cover" transition={200} />

        {status === "sending" && (
          <View style={styles.sendingOverlay}>
            <ActivityIndicator size="small" color={Colors.white} />
          </View>
        )}

        {/* Time overlay with glassmorphism */}
        <View style={styles.timeOverlayContainer}>
          <BlurView intensity={30} tint="dark" style={styles.timeBlur} />
          <View style={styles.timeContent}>
            <Text style={styles.timeText}>{timeStr}</Text>
            {isMe && status !== "sending" && (
              <Ionicons
                name={isRead ? "checkmark-done" : "checkmark"}
                size={14}
                color={isRead ? "#4CAF50" : Colors.white}
                style={styles.checkmark}
              />
            )}
          </View>
        </View>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    maxWidth: IMAGE_MAX_WIDTH,
    borderRadius: 16,
    overflow: "hidden", // Ensures image fits the border radius
    borderWidth: 1, // minimal frame
    borderColor: "rgba(255,255,255,0.1)",
  },
  containerMe: {
    borderBottomRightRadius: 4,
  },
  containerFriend: {
    borderBottomLeftRadius: 4,
  },
  image: {
    width: IMAGE_MAX_WIDTH,
    aspectRatio: 0.8, // Slightly taller than square for modern look
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  sendingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  timeOverlayContainer: {
    position: "absolute",
    bottom: 8,
    right: 8,
    borderRadius: 12,
    overflow: "hidden",
  },
  timeBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  timeContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  timeText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: "500",
  },
  checkmark: {
    marginLeft: 2,
  },
});
