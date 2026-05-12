import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

import { Colors } from "@/constants/theme";
import {
  openPreparedChatFile,
  prepareChatFileForOpening,
  type PreparedChatFile,
} from "@/utils/openChatFile";

const PDF_ICON_SIZE = 54;
const HEADER_ICON_SIZE = 22;
const FALLBACK_ICON_SIZE = 20;

type PdfPreviewStatus = "idle" | "loading" | "ready" | "unsupported" | "error";

type PdfPreviewModalProps = {
  visible: boolean;
  name: string;
  url: string;
  mimeType?: string;
  onClose: () => void;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : "Could not open this PDF.";
}

function canRenderPdfInline(): boolean {
  return Platform.OS === "ios";
}

export const PdfPreviewModal = ({
  visible,
  name,
  url,
  mimeType,
  onClose,
}: PdfPreviewModalProps) => {
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<PdfPreviewStatus>("idle");
  const [preparedFile, setPreparedFile] = useState<PreparedChatFile | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOpeningExternally, setIsOpeningExternally] = useState(false);
  const inlinePreviewAvailable = canRenderPdfInline();

  useEffect(() => {
    let isMounted = true;

    if (!visible) {
      setStatus("idle");
      setPreparedFile(null);
      setErrorMessage(null);
      setIsOpeningExternally(false);
      return () => {
        isMounted = false;
      };
    }

    const preparePdf = async () => {
      try {
        setStatus("loading");
        setPreparedFile(null);
        setErrorMessage(null);

        const file = await prepareChatFileForOpening({ url, name, mimeType });

        if (!isMounted) {
          return;
        }

        setPreparedFile(file);
        setStatus(inlinePreviewAvailable ? "ready" : "unsupported");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(getErrorMessage(error));
        setStatus("error");
      }
    };

    void preparePdf();

    return () => {
      isMounted = false;
    };
  }, [inlinePreviewAvailable, mimeType, name, url, visible]);

  const handleOpenExternally = async (): Promise<void> => {
    try {
      setIsOpeningExternally(true);
      const file = preparedFile ?? (await prepareChatFileForOpening({ url, name, mimeType }));
      await openPreparedChatFile(file);
    } catch (error) {
      console.error("Failed to open PDF externally", error);
      Alert.alert("PDF Error", "Could not open this PDF in another app.");
    } finally {
      setIsOpeningExternally(false);
    }
  };

  const renderFallback = (message: string): React.ReactNode => (
    <View style={styles.centerContent}>
      <Ionicons name="document-text" size={PDF_ICON_SIZE} color={Colors.primary} />
      <Text style={styles.fallbackTitle} numberOfLines={2}>
        {name}
      </Text>
      <Text style={styles.fallbackText}>{message}</Text>
      <Pressable
        style={styles.externalButton}
        onPress={() => { void handleOpenExternally(); }}
        disabled={isOpeningExternally}
      >
        {isOpeningExternally ? (
          <ActivityIndicator size="small" color={Colors.white} />
        ) : (
          <Ionicons name="open-outline" size={FALLBACK_ICON_SIZE} color={Colors.white} />
        )}
        <Text style={styles.externalButtonText}>Open externally</Text>
      </Pressable>
    </View>
  );

  const renderContent = (): React.ReactNode => {
    if (status === "loading" || status === "idle") {
      return (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Opening PDF...</Text>
        </View>
      );
    }

    if (status === "unsupported") {
      return renderFallback("Preview is not available on this device.");
    }

    if (status === "error") {
      return renderFallback(errorMessage ?? "Could not preview this PDF.");
    }

    if (!preparedFile) {
      return renderFallback("Could not find the cached PDF.");
    }

    return (
      <WebView
        source={{ uri: preparedFile.uri }}
        style={styles.webView}
        originWhitelist={["*"]}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.webViewLoading}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        )}
        onError={() => {
          setErrorMessage("Could not preview this PDF.");
          setStatus("error");
        }}
      />
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable style={styles.headerButton} onPress={onClose}>
            <Ionicons name="close" size={HEADER_ICON_SIZE} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {name}
          </Text>
          <Pressable
            style={styles.headerButton}
            onPress={() => { void handleOpenExternally(); }}
            disabled={isOpeningExternally}
          >
            {isOpeningExternally ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Ionicons name="open-outline" size={HEADER_ICON_SIZE} color={Colors.textPrimary} />
            )}
          </Pressable>
        </View>

        <View style={styles.content}>{renderContent()}</View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    minHeight: 60,
    paddingHorizontal: 12,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  content: {
    flex: 1,
  },
  webView: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  webViewLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.background,
  },
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 14,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
  fallbackTitle: {
    color: Colors.textPrimary,
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
  },
  fallbackText: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  externalButton: {
    marginTop: 8,
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  externalButtonText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: "700",
  },
});
