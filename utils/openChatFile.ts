import { File, Paths } from "expo-file-system";
import * as IntentLauncher from "expo-intent-launcher";
import * as Sharing from "expo-sharing";
import { Alert, Platform } from "react-native";

const getSafeFileName = (fileName: string) => {
  return fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
};

export const openChatFile = async (
  url: string,
  name: string,
  mimeType?: string
): Promise<void> => {
  if (!url) return;

  try {
    const safeName = getSafeFileName(name);
    const file = new File(Paths.document, safeName);

    // 1. Download if not cached
    if (!file.exists) {
      await File.downloadFileAsync(url, file);
    }

    // 2. Open file natively
    if (Platform.OS === "android") {
      try {
        const contentUri = file.contentUri;
        await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
          data: contentUri,
          flags: 1, 
          type: mimeType || "*/*",
        });
      } catch (err) {
        console.warn("IntentLauncher failed, falling back to Sharing", err);
        await fallbackShare(file);
      }
    } else {
      await Sharing.shareAsync(file.uri, {
        UTI: mimeType,
        dialogTitle: `Open ${name}`,
      });
    }
  } catch (error) {
    console.error("Error opening file", error);
    Alert.alert("Error", "Could not download or open the file.");
    throw error;
  }
};

const fallbackShare = async (file: File) => {
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(file.uri);
  } else {
    Alert.alert("Unsupported", "Opening files is not supported on this device.");
  }
};
