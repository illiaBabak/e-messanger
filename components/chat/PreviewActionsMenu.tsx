import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/theme";

type PreviewActionHandler = () => Promise<void> | void;

export type PreviewActions = {
  onDownload?: PreviewActionHandler;
  isDownloadInProgress?: boolean;
  downloadStatusText?: string;
  onReply?: PreviewActionHandler;
  onForward?: PreviewActionHandler;
  onDelete?: PreviewActionHandler;
};

type PreviewActionsMenuProps = {
  visible: boolean;
  top: number;
  actions: PreviewActions;
  onClose: () => void;
};

export function hasPreviewActions(actions: PreviewActions | undefined): boolean {
  return Boolean(actions?.onDownload || actions?.onReply || actions?.onForward || actions?.onDelete);
}

export const PreviewActionsMenu = ({
  visible,
  top,
  actions,
  onClose,
}: PreviewActionsMenuProps) => {
  if (!visible) {
    return null;
  }

  const handleAction = (action: PreviewActionHandler | undefined) => {
    onClose();
    void action?.();
  };

  return (
    <Pressable style={styles.overlay} onPress={onClose}>
      <View style={[styles.popoverMenu, { top }]}>
        {actions.onDownload ? (
          <Pressable
            style={[styles.menuItem, actions.isDownloadInProgress && styles.menuItemDisabled]}
            onPress={() => handleAction(actions.onDownload)}
            disabled={actions.isDownloadInProgress}
          >
            {actions.isDownloadInProgress ? (
              <ActivityIndicator size="small" color={Colors.textSecondary} />
            ) : (
              <Ionicons name="download-outline" size={20} color={Colors.textPrimary} />
            )}
            <Text style={styles.menuItemText}>
              {actions.isDownloadInProgress ? actions.downloadStatusText ?? "Saving..." : "Download"}
            </Text>
          </Pressable>
        ) : null}

        {actions.onReply ? (
          <Pressable style={styles.menuItem} onPress={() => handleAction(actions.onReply)}>
            <Ionicons name="arrow-undo-outline" size={20} color={Colors.textPrimary} />
            <Text style={styles.menuItemText}>Reply</Text>
          </Pressable>
        ) : null}

        {actions.onForward ? (
          <Pressable style={styles.menuItem} onPress={() => handleAction(actions.onForward)}>
            <Ionicons name="arrow-redo-outline" size={20} color={Colors.textPrimary} />
            <Text style={styles.menuItemText}>Forward</Text>
          </Pressable>
        ) : null}

        {actions.onDelete ? (
          <>
            <View style={styles.menuDivider} />
            <Pressable style={styles.menuItem} onPress={() => handleAction(actions.onDelete)}>
              <Ionicons name="trash-outline" size={20} color="#FF3B30" />
              <Text style={[styles.menuItemText, styles.destructiveText]}>Delete</Text>
            </Pressable>
          </>
        ) : null}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
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
  menuItemDisabled: {
    opacity: 0.55,
  },
  destructiveText: {
    color: "#FF3B30",
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginVertical: 4,
    marginHorizontal: 16,
  },
});
