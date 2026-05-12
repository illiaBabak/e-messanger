import { Ionicons } from "@expo/vector-icons";
import React, { useRef, useState } from "react";
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/theme";
import { formatFileSize, getFileIconByMimeType, isPdfFile } from "@/utils/fileHelpers";
import { openChatFile } from "@/utils/openChatFile";
import { PdfPreviewModal } from "./PdfPreviewModal";

const LONG_PRESS_SUPPRESSION_MS = 600;
const FILE_CARD_WIDTH = "88%";
const FILE_CARD_MAX_WIDTH = 340;

type MessageLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type FileMessageProps = {
  name: string;
  url: string;
  mimeType?: string;
  size?: number;
  timeStr: string;
  isMe: boolean;
  status?: "sending" | "sent" | "error" | "read";
  isRead?: boolean;
  isSelected?: boolean;
  isForwarded?: boolean;
  isEmbedded?: boolean;
  highlightOpacity?: Animated.Value;
  onPress?: () => void;
  onLongPress?: (layout: MessageLayout) => void;
};

export const FileMessage = ({
  name,
  url,
  mimeType,
  size,
  timeStr,
  isMe,
  status,
  isRead,
  isSelected,
  isForwarded,
  isEmbedded,
  highlightOpacity,
  onPress,
  onLongPress,
}: FileMessageProps) => {
  const containerRef = useRef<View>(null);
  const didLongPressRef = useRef(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPdfPreviewVisible, setIsPdfPreviewVisible] = useState(false);
  const isPdf = isPdfFile({ fileName: name, mimeType, uri: url });

  const handlePress = async (): Promise<void> => {
    if (didLongPressRef.current) {
      didLongPressRef.current = false;
      return;
    }

    if (onPress) {
      onPress();
      return;
    }

    if (!url || isDownloading) return;

    if (isPdf) {
      setIsPdfPreviewVisible(true);
      return;
    }
    
    try {
      setIsDownloading(true);
      await openChatFile(url, name, mimeType);
    } catch {
      // openChatFile handles its own error alerting
    } finally {
      setIsDownloading(false);
    }
  };

  const handleLongPress = (): void => {
    didLongPressRef.current = true;
    containerRef.current?.measure((_x, _y, width, height, pageX, pageY) => {
      onLongPress?.({ x: pageX, y: pageY, width, height });
    });
  };

  const handlePressOut = (): void => {
    if (!didLongPressRef.current) {
      return;
    }

    setTimeout(() => {
      didLongPressRef.current = false;
    }, LONG_PRESS_SUPPRESSION_MS);
  };

  return (
    <>
      <View
        ref={containerRef}
        collapsable={false}
        style={[styles.cardWrapper, isEmbedded && styles.cardWrapperEmbedded]}
      >
        <Pressable
          style={[
            styles.container,
            isMe ? styles.containerMe : styles.containerThem,
            isSelected && styles.containerSelected,
          ]}
          onPress={() => { void handlePress(); }}
          onPressOut={handlePressOut}
          onLongPress={handleLongPress}
          delayLongPress={250}
        >
          {highlightOpacity ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.highlightOverlay,
                {
                  opacity: highlightOpacity,
                  borderBottomLeftRadius: isMe ? 16 : 4,
                  borderBottomRightRadius: isMe ? 4 : 16,
                },
              ]}
            />
          ) : null}

          {isForwarded ? (
            <Text style={[styles.forwardedText, isMe ? styles.forwardedTextMe : styles.forwardedTextThem]}>
              Forwarded message
            </Text>
          ) : null}

          <View style={styles.fileRow}>
            <View style={[styles.iconContainer, isPdf && styles.pdfIconContainer]}>
              {isDownloading ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Ionicons name={getFileIconByMimeType(mimeType, name)} size={28} color={Colors.white} />
              )}
            </View>

            <View style={styles.content}>
              <Text style={styles.nameText} numberOfLines={2} ellipsizeMode="middle">
                {name}
              </Text>

              <View style={styles.detailsRow}>
                <Text style={styles.sizeText} numberOfLines={1}>
                  {formatFileSize(size)}
                </Text>
                <View style={styles.dot} />
                <Text style={styles.timeText} numberOfLines={1}>
                  {timeStr}
                </Text>

                {isMe && status && (
                  <View style={styles.statusIcon}>
                    {status === "sending" && <Ionicons name="time-outline" size={12} color={Colors.textSecondary} />}
                    {status === "sent" && !isRead && <Ionicons name="checkmark" size={14} color={Colors.primary} />}
                    {status === "read" || (status === "sent" && isRead) ? (
                      <Ionicons name="checkmark-done" size={14} color={Colors.primary} />
                    ) : null}
                    {status === "error" && <Ionicons name="alert-circle" size={14} color={Colors.error} />}
                  </View>
                )}
              </View>
            </View>
          </View>
        </Pressable>
      </View>

      <PdfPreviewModal
        visible={isPdfPreviewVisible}
        name={name}
        url={url}
        mimeType={mimeType}
        onClose={() => setIsPdfPreviewVisible(false)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  cardWrapper: {
    width: FILE_CARD_WIDTH,
    maxWidth: FILE_CARD_MAX_WIDTH,
  },
  cardWrapperEmbedded: {
    width: "100%",
    maxWidth: "100%",
  },
  container: {
    width: "100%",
    padding: 12,
    borderRadius: 16,
    marginVertical: 4,
    overflow: "hidden",
  },
  containerMe: {
    backgroundColor: "#E1D5FA",
    borderBottomRightRadius: 4,
  },
  containerThem: {
    backgroundColor: Colors.white,
    borderBottomLeftRadius: 4,
  },
  containerSelected: {
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  highlightOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.15)",
    zIndex: 10,
  },
  forwardedText: {
    fontSize: 12,
    fontStyle: "italic",
    marginBottom: 8,
  },
  forwardedTextMe: {
    color: Colors.primaryDark,
  },
  forwardedTextThem: {
    color: Colors.textSecondary,
  },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
  },
  iconContainer: {
    width: 48,
    height: 48,
    flexShrink: 0,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  pdfIconContainer: {
    backgroundColor: Colors.error,
  },
  content: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  nameText: {
    flexShrink: 1,
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: "500",
    marginBottom: 4,
  },
  detailsRow: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
  },
  sizeText: {
    flexShrink: 1,
    maxWidth: "58%",
    color: Colors.textSecondary,
    fontSize: 12,
  },
  dot: {
    width: 3,
    height: 3,
    flexShrink: 0,
    borderRadius: 1.5,
    backgroundColor: Colors.border,
    marginHorizontal: 6,
  },
  timeText: {
    flexShrink: 0,
    color: Colors.textSecondary,
    fontSize: 11,
  },
  statusIcon: {
    flexShrink: 0,
    marginLeft: 4,
    justifyContent: "center",
    alignItems: "center",
  },
});
