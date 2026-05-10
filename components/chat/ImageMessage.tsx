import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Dimensions, Pressable, StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/theme";
import { getCachedMediaUriAsync } from "@/utils/mediaCache";
import { MediaHighlightFrame } from "./MediaHighlightFrame";

const { width } = Dimensions.get("window");
const IMAGE_MAX_WIDTH = width * 0.55; // 55% of screen width
const IMAGE_ASPECT_RATIO = 0.8;
const REMOTE_URI_PATTERN = /^https?:\/\//i;

function getInitialDisplayUri(uri: string): string | null {
  return REMOTE_URI_PATTERN.test(uri.trim()) ? null : uri;
}

export type ImageMessageProps = {
  url: string;
  isMe: boolean;
  timeStr: string;
  status?: "sending" | "sent" | "error" | "read";
  isRead?: boolean;
  highlightOpacity?: Animated.Value;
  onPress: () => void;
  onLongPress: (layout: { x: number; y: number; width: number; height: number }) => void;
};

export const ImageMessage = ({
  url,
  isMe,
  timeStr,
  status,
  isRead,
  highlightOpacity,
  onPress,
  onLongPress,
}: ImageMessageProps) => {
  const containerRef = useRef<View>(null);
  const [displayUri, setDisplayUri] = useState<string | null>(() => getInitialDisplayUri(url));

  useEffect(() => {
    let isMounted = true;

    setDisplayUri(getInitialDisplayUri(url));

    const resolveCachedImage = async () => {
      const cachedUri = await getCachedMediaUriAsync({
        uri: url,
        mediaType: "image",
      });

      if (isMounted) {
        setDisplayUri(cachedUri);
      }
    };

    resolveCachedImage();

    return () => {
      isMounted = false;
    };
  }, [url]);

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
        style={styles.container}
      >
        <MediaHighlightFrame
          isMe={isMe}
          highlightOpacity={highlightOpacity}
          style={styles.mediaHighlightOuter}
          clipStyle={styles.mediaClip}
        >
          {displayUri ? (
            <Image source={displayUri} style={styles.mediaImage} contentFit="cover" transition={200} />
          ) : (
            <View style={styles.cacheLoadingOverlay}>
              <ActivityIndicator size="small" color={Colors.white} />
            </View>
          )}

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
        </MediaHighlightFrame>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    maxWidth: IMAGE_MAX_WIDTH,
  },
  mediaHighlightOuter: {
    width: IMAGE_MAX_WIDTH,
    aspectRatio: IMAGE_ASPECT_RATIO,
  },
  mediaClip: {
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  mediaImage: {
    ...StyleSheet.absoluteFillObject,
  },
  sendingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  cacheLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.16)",
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
