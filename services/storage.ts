import storage from '@react-native-firebase/storage';

export class StorageError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.code = code;
    this.name = 'StorageError';
  }
}

export async function uploadProfilePicture(uri: string, userId: string): Promise<string> {
  try {
    const extension = uri.split('.').pop() || 'jpg';
    const filename = `avatars/${userId}.${extension}`;
    const reference = storage().ref(filename);

    await reference.putFile(uri);

    const downloadURL = await reference.getDownloadURL();
    
    return downloadURL;
  } catch (error) {
    console.error('[Storage] uploadProfilePicture error', error);
    throw new StorageError('Failed to upload image', 'storage/upload-failed');
  }
}
