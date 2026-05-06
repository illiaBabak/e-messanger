import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useState } from "react";
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/theme";

const { width, height } = Dimensions.get("window");

export type ImagePreviewModalProps = {
  visible: boolean;
  imageUrl: string | null;
  contactName: string;
  timeStr: string;
  onClose: () => void;
  onReply: () => void;
  onDownload: () => void;
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
  onDelete,
  onForward,
}: ImagePreviewModalProps) => {
  const insets = useSafeAreaInsets();
  const [menuVisible, setMenuVisible] = useState(false);

  if (!imageUrl) return null;

  const handleAction = (action: () => void) => {
    setMenuVisible(false);
    action();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Full screen image */}
        <Image
          source={imageUrl}
          style={styles.image}
          contentFit="contain"
          transition={200}
        />

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
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuVisible(false)}>
            <View style={[styles.popoverMenu, { top: Math.max(insets.top, 20) + 44 }]}>
              <Pressable style={styles.menuItem} onPress={() => handleAction(onDownload)}>
                <Ionicons name="download-outline" size={20} color={Colors.textPrimary} />
                <Text style={styles.menuItemText}>Download</Text>
              </Pressable>
              <Pressable style={styles.menuItem} onPress={() => handleAction(onReply)}>
                <Ionicons name="arrow-undo-outline" size={20} color={Colors.textPrimary} />
                <Text style={styles.menuItemText}>Reply</Text>
              </Pressable>
              <Pressable style={styles.menuItem} onPress={() => handleAction(onForward)}>
                <Ionicons name="arrow-redo-outline" size={20} color={Colors.textPrimary} />
                <Text style={styles.menuItemText}>Forward</Text>
              </Pressable>
              <View style={styles.menuDivider} />
              <Pressable style={styles.menuItem} onPress={() => handleAction(onDelete)}>
                <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                <Text style={[styles.menuItemText, { color: "#FF3B30" }]}>Delete</Text>
              </Pressable>
            </View>
          </Pressable>
        )}
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
  popoverMenu: {
    position: "absolute",
    right: 16,
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingVertical: 8,
    minWidth: 160,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  menuItemText: {
    color: Colors.textPrimary,
    fontSize: 16,
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginVertical: 4,
    marginHorizontal: 16,
  },
});
