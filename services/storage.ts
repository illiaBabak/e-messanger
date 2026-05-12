import { ensureUploadableLocalFileAsync } from "@/utils/ensureUploadableLocalFile";
import { getFileExtensionFromMetadata, normalizeMimeType } from "@/utils/fileKind";
import { assertVideoUploadSize } from "@/utils/videoCompression";
import { getDownloadURL, putFile, ref } from "@react-native-firebase/storage";
import { storage } from "./firebase";

const FILE_URI_PREFIX = "file://";
const DEFAULT_IMAGE_EXTENSION = "jpg";
const DEFAULT_VIDEO_EXTENSION = "mp4";
const DEFAULT_FILE_EXTENSION = "bin";
const DEFAULT_VIDEO_MIME_TYPE = "video/mp4";

export class StorageError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.code = code;
    this.name = 'StorageError';
  }
}

export type UploadFileMessageResult = {
  url: string;
  storagePath: string;
  extension: string;
};

export async function uploadProfilePicture(
  uri: string,
  userId: string
): Promise<string> {
  try {
    const cleanUri = uri.replace(FILE_URI_PREFIX, "");
    const extension = cleanUri.split(".").pop() || DEFAULT_IMAGE_EXTENSION;

    const filename = `avatars/${userId}.${extension}`;

    const storageRef = ref(storage, filename);

    await putFile(storageRef, cleanUri);

    const downloadURL = await getDownloadURL(storageRef);

    return downloadURL;
  } catch (error) {
    console.error("[Storage] uploadProfilePicture error", error);
    throw new StorageError("Failed to upload image", "storage/upload-failed");
  }
}

export async function uploadVoiceMessage(
  uri: string,
  chatId: string,
  messageId: string
): Promise<string> {
  try {
    const cleanUri = uri.replace(FILE_URI_PREFIX, "");
    const extension = cleanUri.split(".").pop() || "m4a";

    const filename = `chats/${chatId}/audio/${messageId}.${extension}`;
    const storageRef = ref(storage, filename);

    await putFile(storageRef, cleanUri);
    const downloadURL = await getDownloadURL(storageRef);

    return downloadURL;
  } catch (error) {
    console.error("[Storage] uploadVoiceMessage error", error);
    throw new StorageError("Failed to upload voice message", "storage/upload-failed");
  }
}

export async function uploadImageMessage(
  uri: string,
  chatId: string,
  messageId: string,
  index: number
): Promise<string> {
  try {
    const cleanUri = uri.replace(FILE_URI_PREFIX, "");
    const extension = cleanUri.split(".").pop() || DEFAULT_IMAGE_EXTENSION;

    const filename = `chats/${chatId}/images/${messageId}_${index}.${extension}`;
    const storageRef = ref(storage, filename);

    await putFile(storageRef, cleanUri);
    const downloadURL = await getDownloadURL(storageRef);

    return downloadURL;
  } catch (error) {
    console.error("[Storage] uploadImageMessage error", error);
    throw new StorageError("Failed to upload image message", "storage/upload-failed");
  }
}

export async function uploadVideoMessage(
  uri: string,
  chatId: string,
  messageId: string,
  originalName?: string,
  mimeType: string = DEFAULT_VIDEO_MIME_TYPE,
): Promise<string> {
  try {
    const uploadableFile = await ensureUploadableLocalFileAsync({
      uri,
      fileName: originalName ?? `${messageId}.${DEFAULT_VIDEO_EXTENSION}`,
      mimeType,
    });
    if (uploadableFile.size !== undefined) {
      assertVideoUploadSize(uploadableFile.size);
    }

    const cleanUri = uploadableFile.uri.replace(FILE_URI_PREFIX, "");
    const extension =
      uploadableFile.fileName.split(".").pop() ||
      cleanUri.split(".").pop() ||
      DEFAULT_VIDEO_EXTENSION;

    const filename = `chats/${chatId}/videos/${messageId}.${extension}`;
    const storageRef = ref(storage, filename);

    await putFile(storageRef, cleanUri, { contentType: uploadableFile.mimeType });
    const downloadURL = await getDownloadURL(storageRef);

    return downloadURL;
  } catch (error) {
    console.error("[Storage] uploadVideoMessage error", error);
    throw new StorageError("Failed to upload video message", "storage/upload-failed");
  }
}

export async function uploadFileMessage(
  uri: string,
  originalName: string,
  chatId: string,
  messageId: string,
  mimeType?: string,
): Promise<UploadFileMessageResult> {
  try {
    const uploadableFile = await ensureUploadableLocalFileAsync({
      uri,
      fileName: originalName,
      mimeType: mimeType || "application/octet-stream",
    });

    const cleanUri = uploadableFile.uri.replace(FILE_URI_PREFIX, "");
    const extension =
      getFileExtensionFromMetadata({
        fileName: originalName,
        mimeType,
        uri,
      }) || DEFAULT_FILE_EXTENSION;
    const contentType = normalizeMimeType(mimeType);

    const filename = `chats/${chatId}/files/${messageId}.${extension}`;
    const storageRef = ref(storage, filename);

    if (contentType) {
      await putFile(storageRef, cleanUri, { contentType });
    } else {
      await putFile(storageRef, cleanUri);
    }

    const downloadURL = await getDownloadURL(storageRef);

    return {
      url: downloadURL,
      storagePath: filename,
      extension,
    };
  } catch (error) {
    console.error("[Storage] uploadFileMessage error", error);
    throw new StorageError("Failed to upload file message", "storage/upload-failed");
  }
}
