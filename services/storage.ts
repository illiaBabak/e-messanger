import { getDownloadURL, putFile, ref } from "@react-native-firebase/storage";
import { storage } from "./firebase";

export class StorageError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.code = code;
    this.name = 'StorageError';
  }
}

export async function uploadProfilePicture(
  uri: string,
  userId: string
): Promise<string> {
  try {
    const cleanUri = uri.replace("file://", "");
    const extension = cleanUri.split(".").pop() || "jpg";

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
    const cleanUri = uri.replace("file://", "");
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