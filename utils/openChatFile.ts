import { Directory, File, Paths } from "expo-file-system";
import * as IntentLauncher from "expo-intent-launcher";
import * as Sharing from "expo-sharing";
import { Alert, Platform } from "react-native";

import {
  getDisplayFileName,
  getFileExtension,
  getFileExtensionFromMetadata,
} from "@/utils/fileKind";

const FILE_URI_PATTERN = /^file:\/\//i;
const REMOTE_URI_PATTERN = /^https?:\/\//i;
const CACHE_DIRECTORY_NAME = "chat-file-cache";
const DEFAULT_FILE_EXTENSION = "bin";
const SAFE_FILE_NAME_MAX_LENGTH = 90;
const HASH_INITIAL_VALUE = 2166136261;
const HASH_MULTIPLIER = 16777619;
const HASH_RADIX = 36;
const ANDROID_GRANT_READ_URI_PERMISSION = 1;

export type PreparedChatFile = {
  file: File;
  uri: string;
  name: string;
  mimeType?: string;
};

type ChatFileInput = {
  url: string;
  name: string;
  mimeType?: string;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : "Unknown error";
}

function hashString(value: string): string {
  let hash = HASH_INITIAL_VALUE;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, HASH_MULTIPLIER);
  }

  return (hash >>> 0).toString(HASH_RADIX);
}

function sanitizeFileName(fileName: string, extension: string): string {
  const fallbackName = `file.${extension || DEFAULT_FILE_EXTENSION}`;
  const sourceName = fileName.trim() || fallbackName;
  const sanitized = sourceName
    .split("?")[0]
    .split("#")[0]
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, SAFE_FILE_NAME_MAX_LENGTH);

  const safeName = sanitized || fallbackName;

  return getFileExtension(safeName) ? safeName : `${safeName}.${extension || DEFAULT_FILE_EXTENSION}`;
}

function getChatFileCacheDirectory(): Directory {
  const directory = new Directory(Paths.cache, CACHE_DIRECTORY_NAME);
  directory.create({ idempotent: true, intermediates: true });

  return directory;
}

function getCachedChatFile(input: ChatFileInput): File {
  const extension =
    getFileExtensionFromMetadata({
      fileName: input.name,
      mimeType: input.mimeType,
      uri: input.url,
    }) || DEFAULT_FILE_EXTENSION;
  const safeName = sanitizeFileName(input.name, extension);
  const dotIndex = safeName.lastIndexOf(".");
  const baseName = dotIndex > 0 ? safeName.slice(0, dotIndex) : safeName;
  const fileExtension = dotIndex > 0 ? safeName.slice(dotIndex + 1) : extension;

  return new File(
    getChatFileCacheDirectory(),
    `${baseName}-${hashString(input.url)}.${fileExtension}`,
  );
}

function isUsableFile(file: File): boolean {
  try {
    const info = file.info();
    return info.exists && (info.size ?? file.size) > 0;
  } catch {
    return false;
  }
}

function deleteFileSafely(file: File): void {
  try {
    if (file.exists) {
      file.delete();
    }
  } catch {
    // Best-effort cleanup before a fresh download.
  }
}

function verifyUsableFile(file: File, displayName: string): void {
  if (!isUsableFile(file)) {
    throw new Error(`The file "${displayName}" is missing or empty.`);
  }
}

async function downloadRemoteFileToCacheAsync(input: ChatFileInput, destination: File): Promise<File> {
  deleteFileSafely(destination);

  try {
    await File.downloadFileAsync(input.url, destination, { idempotent: true });
    verifyUsableFile(destination, input.name);

    return destination;
  } catch (error) {
    deleteFileSafely(destination);
    throw new Error(`Failed to download file: ${getErrorMessage(error)}`);
  }
}

export async function prepareChatFileForOpening(input: ChatFileInput): Promise<PreparedChatFile> {
  const url = input.url.trim();
  const name = getDisplayFileName({
    fileName: input.name,
    mimeType: input.mimeType,
    uri: url,
  });

  if (url.length === 0) {
    throw new Error("File URL is missing.");
  }

  if (FILE_URI_PATTERN.test(url)) {
    const file = new File(url);
    verifyUsableFile(file, name);

    return {
      file,
      uri: file.uri,
      name,
      mimeType: input.mimeType,
    };
  }

  if (!REMOTE_URI_PATTERN.test(url)) {
    throw new Error("Unsupported file URL.");
  }

  const cachedFile = getCachedChatFile({
    ...input,
    name,
    url,
  });

  if (isUsableFile(cachedFile)) {
    return {
      file: cachedFile,
      uri: cachedFile.uri,
      name,
      mimeType: input.mimeType,
    };
  }

  const downloadedFile = await downloadRemoteFileToCacheAsync(
    {
      ...input,
      name,
      url,
    },
    cachedFile,
  );

  return {
    file: downloadedFile,
    uri: downloadedFile.uri,
    name,
    mimeType: input.mimeType,
  };
}

async function fallbackShare(file: PreparedChatFile): Promise<void> {
  const canShare = await Sharing.isAvailableAsync();

  if (!canShare) {
    throw new Error("Opening files is not supported on this device.");
  }

  await Sharing.shareAsync(file.uri, {
    dialogTitle: `Open ${file.name}`,
    UTI: file.mimeType,
  });
}

export async function openPreparedChatFile(file: PreparedChatFile): Promise<void> {
  if (Platform.OS === "android") {
    try {
      await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
        data: file.file.contentUri,
        flags: ANDROID_GRANT_READ_URI_PERMISSION,
        type: file.mimeType || "*/*",
      });
      return;
    } catch (error) {
      console.warn("IntentLauncher failed, falling back to Sharing", error);
    }
  }

  await fallbackShare(file);
}

export const openChatFile = async (
  url: string,
  name: string,
  mimeType?: string,
): Promise<void> => {
  try {
    const file = await prepareChatFileForOpening({ url, name, mimeType });
    await openPreparedChatFile(file);
  } catch (error) {
    console.error("Error opening file", error);
    Alert.alert("Error", "Could not download or open the file.");
    throw error;
  }
};
