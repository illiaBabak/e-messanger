import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { getThumbnailAsync } from "expo-video-thumbnails";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Dimensions, Pressable, StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/theme";

const { width } = Dimensions.get("window");
const VIDEO_MAX_WIDTH = width * 0.55;
const THUMBNAIL_TIME_MS = 1000;

export type MessageLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type VideoMessageProps = {
  uri: string;
  fileName: string;
  isMe: boolean;
  timeStr: string;
  duration?: number;
  status?: "sending" | "sent" | "error" | "read";
  isRead?: boolean;
  onPress: () => void;
  onLongPress: (layout: MessageLayout) => void;
};

const formatDuration = (durationMs: number | undefined): string => {
  if (!durationMs || durationMs <= 0) {
    return "--:--";
  }

  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

export const VideoMessage = ({
  uri,
  fileName,
  isMe,
  timeStr,
  duration,
  status,
  isRead,
  onPress,
  onLongPress,
}: VideoMessageProps) => {
  const containerRef = useRef<View>(null);
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);
  const [isThumbnailLoading, setIsThumbnailLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadThumbnail = async () => {
      if (!uri.trim()) {
        setThumbnailUri(null);
        return;
      }

      try {
        setIsThumbnailLoading(true);

        const result = await getThumbnailAsync(uri, { time: THUMBNAIL_TIME_MS });

        if (isMounted) {
          setThumbnailUri(result.uri);
        }
      } catch {
        if (isMounted) {
          setThumbnailUri(null);
        }
      } finally {
        if (isMounted) {
          setIsThumbnailLoading(false);
        }
      }
    };

    loadThumbnail();

    return () => {
      isMounted = false;
    };
  }, [uri]);

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
        <View style={styles.preview}>
          {thumbnailUri ? (
            <Image source={thumbnailUri} style={styles.thumbnail} contentFit="cover" />
          ) : (
            <View style={styles.fallbackPreview}>
              <Ionicons name="videocam" size={32} color="rgba(255,255,255,0.82)" />
              <Text style={styles.fallbackText} numberOfLines={1}>
                Video
              </Text>
            </View>
          )}
          <View style={styles.playOverlay}>
            {isThumbnailLoading ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Ionicons name="play-circle" size={54} color={Colors.white} />
            )}
          </View>
          <View style={styles.videoBadge}>
            <Ionicons name="videocam" size={14} color={Colors.white} />
            <Text style={styles.durationText}>{formatDuration(duration)}</Text>
          </View>
        </View>

        <View style={styles.fileNameOverlay}>
          <Text style={styles.fileNameText} numberOfLines={1}>
            {fileName}
          </Text>
        </View>

        {status === "sending" && (
          <View style={styles.sendingOverlay}>
            <ActivityIndicator size="small" color={Colors.white} />
          </View>
        )}

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
    maxWidth: VIDEO_MAX_WIDTH,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "#111827",
  },
  containerMe: {
    borderBottomRightRadius: 4,
  },
  containerFriend: {
    borderBottomLeftRadius: 4,
  },
  preview: {
    width: VIDEO_MAX_WIDTH,
    aspectRatio: 0.8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#263244",
  },
  thumbnail: {
    ...StyleSheet.absoluteFillObject,
  },
  fallbackPreview: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
    backgroundColor: "#263244",
  },
  fallbackText: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 12,
    fontWeight: "700",
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.12)",
  },
  videoBadge: {
    position: "absolute",
    left: 10,
    bottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  durationText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: "600",
  },
  fileNameOverlay: {
    position: "absolute",
    left: 10,
    right: 10,
    top: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  fileNameText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: "600",
  },
  sendingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
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
