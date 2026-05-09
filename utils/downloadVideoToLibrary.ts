import { getUriWithoutHash } from "@/utils/ensureUploadableLocalFile";
import { Directory, File as ExpoFile, Paths } from "expo-file-system";
import * as MediaLibrary from "expo-media-library";

const FILE_URI_PREFIX = "file://";
const REMOTE_URI_PATTERN = /^https?:\/\//i;
const DOWNLOAD_CACHE_DIRECTORY_NAME = "chat-video-downloads";
const DEFAULT_VIDEO_FILE_NAME = "video.mp4";
const DEFAULT_VIDEO_EXTENSION = "mp4";
const UNIQUE_NAME_RADIX = 36;
const OBJECT_LIKE_URI_PATTERN = /^(\[object Object\]|\{|\[)/;

const MIME_TYPE_EXTENSIONS: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/x-m4v": "m4v",
  "video/3gpp": "3gp",
};

type NormalizedVideoUri =
  | {
      kind: "remote";
      uri: string;
    }
  | {
      kind: "local";
      uri: string;
    };

export type DownloadVideoToLibraryInput = {
  uri: string;
  fileName?: string;
  mimeType?: string;
};

export type DownloadVideoToLibraryResult = {
  localUri: string;
  assetId: string;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function getExtensionFromFileName(fileName: string | undefined): string | undefined {
  if (!fileName) {
    return undefined;
  }

  const withoutQuery = fileName.trim().split("?")[0].split("#")[0];
  const dotIndex = withoutQuery.lastIndexOf(".");

  if (dotIndex <= 0 || dotIndex === withoutQuery.length - 1) {
    return undefined;
  }

  return withoutQuery.slice(dotIndex + 1).toLowerCase();
}

function getExtensionFromUrl(uri: string): string | undefined {
  try {
    const url = new URL(uri);
    return getExtensionFromFileName(url.pathname);
  } catch {
    return getExtensionFromFileName(uri);
  }
}

function getVideoExtension(input: DownloadVideoToLibraryInput): string {
  return (
    getExtensionFromFileName(input.fileName) ??
    (input.mimeType ? MIME_TYPE_EXTENSIONS[input.mimeType.toLowerCase()] : undefined) ??
    getExtensionFromUrl(input.uri) ??
    DEFAULT_VIDEO_EXTENSION
  );
}

function sanitizeFileName(fileName: string | undefined, extension: string): string {
  const sourceName = fileName?.trim() || DEFAULT_VIDEO_FILE_NAME;
  const withoutQuery = sourceName.split("?")[0].split("#")[0];

  const sanitized = withoutQuery
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .replace(/^[-.]+|[-.]+$/g, "");

  const safeName = sanitized || DEFAULT_VIDEO_FILE_NAME;

  return getExtensionFromFileName(safeName) ? safeName : `${safeName}.${extension}`;
}

function createUniquePrefix(): string {
  const timestamp = Date.now().toString(UNIQUE_NAME_RADIX);
  const random = Math.random().toString(UNIQUE_NAME_RADIX).slice(2, 10);

  return `${timestamp}-${random}`;
}

function getDownloadCacheDirectory(): Directory {
  const directory = new Directory(Paths.cache, DOWNLOAD_CACHE_DIRECTORY_NAME);
  directory.create({ idempotent: true, intermediates: true });

  return directory;
}

function createFreshDownloadFile(input: DownloadVideoToLibraryInput): ExpoFile {
  const directory = getDownloadCacheDirectory();
  const extension = getVideoExtension(input);
  const safeName = sanitizeFileName(input.fileName, extension);

  return new ExpoFile(directory, `${createUniquePrefix()}-${safeName}`);
}

async function requestMediaLibraryPermissionAsync(): Promise<void> {
  const permission = await MediaLibrary.requestPermissionsAsync(false, ["video"]);

  if (!permission.granted) {
    throw new Error("Media library permission was denied.");
  }
}

function verifyLocalFile(file: ExpoFile): void {
  const info = file.info();

  if (!info.exists) {
    throw new Error(`Video file does not exist: ${file.uri}`);
  }

  if (info.size !== undefined && info.size !== null && info.size <= 0) {
    throw new Error(`Video file is empty: ${file.uri}`);
  }
}

function normalizeVideoUri(rawUri: string): NormalizedVideoUri {
  const uri = getUriWithoutHash(rawUri).trim();

  if (uri.length === 0) {
    throw new Error("Video URI is empty.");
  }

  if (OBJECT_LIKE_URI_PATTERN.test(uri)) {
    throw new Error("Video URI is invalid.");
  }

  if (uri.startsWith(FILE_URI_PREFIX)) {
    return {
      kind: "local",
      uri,
    };
  }

  if (REMOTE_URI_PATTERN.test(uri)) {
    try {
      const url = new URL(uri);

      if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error(`Unsupported remote video URL protocol: ${url.protocol}`);
      }

      return {
        kind: "remote",
        uri: url.toString(),
      };
    } catch (error) {
      throw new Error(`Video URL is invalid: ${getErrorMessage(error)}`);
    }
  }

  throw new Error(`Unsupported video URI for saving: ${uri}`);
}
async function downloadRemoteVideoToFreshCacheAsync(
  input: DownloadVideoToLibraryInput,
  uri: string,
): Promise<ExpoFile> {
  const destinationFile = createFreshDownloadFile({
    ...input,
    uri,
  });

  try {
    if (destinationFile.exists) {
      destinationFile.delete();
    }

    await ExpoFile.downloadFileAsync(uri, destinationFile);

    verifyLocalFile(destinationFile);

    return destinationFile;
  } catch (error) {
    throw new Error(`Failed to download video before saving: ${getErrorMessage(error)}`);
  }
}

async function copyLocalVideoToFreshCacheAsync(
  input: DownloadVideoToLibraryInput,
  uri: string,
): Promise<ExpoFile> {
  const sourceFile = new ExpoFile(uri);
  const destinationFile = createFreshDownloadFile({
    ...input,
    uri,
  });

  try {
    verifyLocalFile(sourceFile);

    if (destinationFile.exists) {
      destinationFile.delete();
    }

    sourceFile.copy(destinationFile);

    verifyLocalFile(destinationFile);

    return destinationFile;
  } catch (error) {
    throw new Error(`Failed to copy video before saving: ${getErrorMessage(error)}`);
  }
}

async function createFreshLocalVideoFileAsync(
  input: DownloadVideoToLibraryInput,
): Promise<ExpoFile> {
  const normalizedUri = normalizeVideoUri(input.uri);

  if (normalizedUri.kind === "remote") {
    return downloadRemoteVideoToFreshCacheAsync(
      {
        ...input,
        uri: normalizedUri.uri,
      },
      normalizedUri.uri,
    );
  }

  return copyLocalVideoToFreshCacheAsync(
    {
      ...input,
      uri: normalizedUri.uri,
    },
    normalizedUri.uri,
  );
}

export async function downloadVideoToLibraryAsync(
  input: DownloadVideoToLibraryInput,
): Promise<DownloadVideoToLibraryResult> {
  await requestMediaLibraryPermissionAsync();

  const freshLocalFile = await createFreshLocalVideoFileAsync(input);
  let asset: MediaLibrary.Asset;

  try {
    asset = await MediaLibrary.createAssetAsync(freshLocalFile.uri);
  } catch (error) {
    throw new Error(`Failed to save video to media library: ${getErrorMessage(error)}`);
  }

  return {
    localUri: freshLocalFile.uri,
    assetId: asset.id,
  };
}
