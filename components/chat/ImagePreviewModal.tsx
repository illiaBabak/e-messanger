import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Dimensions, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/theme";
import { getCachedMediaUriAsync } from "@/utils/mediaCache";
import { PreviewActionsMenu } from "./PreviewActionsMenu";

const { width, height } = Dimensions.get("window");
const REMOTE_URI_PATTERN = /^https?:\/\//i;

function getInitialDisplayImageUrl(uri: string | null): string | null {
  if (!uri) {
    return null;
  }

  return REMOTE_URI_PATTERN.test(uri.trim()) ? null : uri;
}

export type ImagePreviewModalProps = {
  visible: boolean;
  imageUrl: string | null;
  contactName: string;
  timeStr: string;
  onClose: () => void;
  onReply: () => void;
  onDownload: () => void;
  isDownloadInProgress?: boolean;
  downloadStatusText?: string;
  onDelete: () => void;
  onForward: () => void;
};

export const ImagePreviewModal = ({
  visible,
  imageUrl,
  contactName,
  timeStr,
  onClose,
  onReply,
  onDownload,
  isDownloadInProgress = false,
  downloadStatusText = "Saving image...",
  onDelete,
  onForward,
}: ImagePreviewModalProps) => {
  const insets = useSafeAreaInsets();
  const [menuVisible, setMenuVisible] = useState(false);
  const [displayImageUrl, setDisplayImageUrl] = useState<string | null>(() => getInitialDisplayImageUrl(imageUrl));

  useEffect(() => {
    let isMounted = true;

    setDisplayImageUrl(getInitialDisplayImageUrl(imageUrl));

    const resolveCachedImage = async () => {
      if (!imageUrl) {
        return;
      }

      const cachedUri = await getCachedMediaUriAsync({
        uri: imageUrl,
        mediaType: "image",
      });

      if (isMounted) {
        setDisplayImageUrl(cachedUri);
      }
    };

    resolveCachedImage();

    return () => {
      isMounted = false;
    };
  }, [imageUrl]);

  if (!imageUrl) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Full screen image */}
        {displayImageUrl ? (
          <Image
            source={displayImageUrl}
            style={styles.image}
            contentFit="contain"
            transition={200}
          />
        ) : (
          <View style={styles.imageLoadingContainer}>
            <ActivityIndicator size="large" color={Colors.white} />
          </View>
        )}

        {/* Top Header Overlay */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
          {/* Back Button */}
          <Pressable onPress={onClose} style={styles.iconButton}>
            <Ionicons name="arrow-back" size={26} color={Colors.white} />
          </Pressable>

          {/* Center Info */}
          <View style={styles.centerInfo}>
            <Text style={styles.nameText}>{contactName}</Text>
            <Text style={styles.timeText}>{timeStr}</Text>
          </View>

          {/* 3-Dots Menu Button */}
          <Pressable onPress={() => setMenuVisible(true)} style={styles.iconButton}>
            <Ionicons name="ellipsis-vertical" size={24} color={Colors.white} />
          </Pressable>
        </View>

        {/* Popover Menu Overlay */}
        {menuVisible && (
          <PreviewActionsMenu
            visible={menuVisible}
            top={Math.max(insets.top, 20) + 44}
            onClose={() => setMenuVisible(false)}
            actions={{
              onDownload,
              isDownloadInProgress,
              downloadStatusText,
              onReply,
              onForward,
              onDelete,
            }}
          />
        )}

        {isDownloadInProgress ? (
          <View style={styles.downloadOverlay} pointerEvents="none">
            <ActivityIndicator size="small" color={Colors.white} />
            <Text style={styles.downloadOverlayText}>{downloadStatusText}</Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    width,
    height,
  },
  imageLoadingContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: "rgba(0,0,0,0.4)", // Slight darkening to make text readable
  },
  iconButton: {
    padding: 8,
    borderRadius: 20,
  },
  centerInfo: {
    alignItems: "center",
  },
  nameText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: "600",
  },
  timeText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    marginTop: 2,
  },
  downloadOverlay: {
    position: "absolute",
    alignSelf: "center",
    bottom: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.72)",
  },
  downloadOverlayText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: "600",
  },
});
