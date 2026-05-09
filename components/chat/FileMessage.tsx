import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/theme";
import { formatFileSize, getFileIconByMimeType } from "@/utils/fileHelpers";
import { openChatFile } from "@/utils/openChatFile";

type FileMessageProps = {
  name: string;
  url: string;
  mimeType?: string;
  size?: number;
  timeStr: string;
  isMe: boolean;
  status?: "sending" | "sent" | "error" | "read";
  isRead?: boolean;
  onLongPress?: () => void;
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
  onLongPress,
}: FileMessageProps) => {
  const [isDownloading, setIsDownloading] = useState(false);

  const handlePress = async () => {
    if (!url || isDownloading) return;
    
    try {
      setIsDownloading(true);
      await openChatFile(url, name, mimeType);
    } catch (error) {
      // openChatFile handles its own error alerting
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Pressable
      style={[styles.container, isMe ? styles.containerMe : styles.containerThem]}
      onPress={handlePress}
      onLongPress={onLongPress}
      delayLongPress={250}
    >
      <View style={styles.iconContainer}>
        {isDownloading ? (
          <ActivityIndicator size="small" color={Colors.white} />
        ) : (
          <Ionicons name={getFileIconByMimeType(mimeType, name)} size={28} color={Colors.white} />
        )}
      </View>
      
      <View style={styles.content}>
        <Text style={styles.nameText} numberOfLines={1}>
          {name}
        </Text>
        
        <View style={styles.detailsRow}>
          <Text style={styles.sizeText}>{formatFileSize(size)}</Text>
          <View style={styles.dot} />
          <Text style={styles.timeText}>{timeStr}</Text>
          
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
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    maxWidth: "85%",
    padding: 12,
    borderRadius: 16,
    marginVertical: 4,
  },
  containerMe: {
    alignSelf: "flex-end",
    backgroundColor: "#E1D5FA",
    borderBottomRightRadius: 4,
  },
  containerThem: {
    alignSelf: "flex-start",
    backgroundColor: Colors.white,
    borderBottomLeftRadius: 4,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  content: {
    flex: 1,
    justifyContent: "center",
  },
  nameText: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: "500",
    marginBottom: 4,
  },
  detailsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  sizeText: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.border,
    marginHorizontal: 6,
  },
  timeText: {
    color: Colors.textSecondary,
    fontSize: 11,
  },
  statusIcon: {
    marginLeft: 4,
    justifyContent: "center",
    alignItems: "center",
  },
});
