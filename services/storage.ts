import { getDownloadURL, ref, uploadBytes } from "@react-native-firebase/storage";
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
    const extension = uri.split(".").pop() || "jpg";
    const filename = `avatars/${userId}.${extension}`;

    const storageRef = ref(storage, filename);

    const response = await fetch(uri);
    
    const blob = await response.blob();

    await uploadBytes(storageRef, blob);

    const downloadURL = await getDownloadURL(storageRef);

    return downloadURL;
  } catch (error) {
    console.error("[Storage] uploadProfilePicture error", error);
    throw new StorageError("Failed to upload image", "storage/upload-failed");
  }
}