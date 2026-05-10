import { Directory, File as ExpoFile, Paths } from "expo-file-system";

const FILE_URI_PATTERN = /^file:\/\//i;
const REMOTE_URI_PATTERN = /^https?:\/\//i;
const CACHE_DIRECTORY_NAME = "chat-media-cache";
const DEFAULT_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 14;
const MAX_SAFE_KEY_LENGTH = 80;
const HASH_INITIAL_VALUE = 2166136261;
const HASH_MULTIPLIER = 16777619;
const HASH_RADIX = 36;

export type MediaCacheType = "image" | "video" | "thumbnail";

export type MediaCacheInput = {
  uri: string;
  cacheKey?: string;
  mediaType: MediaCacheType;
  mimeType?: string;
  fileName?: string;
};

const MEDIA_CACHE_TYPES: MediaCacheType[] = ["image", "video", "thumbnail"];

const MIME_TYPE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/x-m4v": "m4v",
  "video/3gpp": "3gp",
};

const DEFAULT_EXTENSIONS: Record<MediaCacheType, string> = {
  image: "jpg",
  video: "mp4",
  thumbnail: "jpg",
};

const pendingDownloads = new Map<string, Promise<string>>();

function getExtensionFromName(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const cleanValue = value.trim().split("?")[0].split("#")[0];
  const dotIndex = cleanValue.lastIndexOf(".");

  if (dotIndex <= 0 || dotIndex === cleanValue.length - 1) {
    return undefined;
  }

  return cleanValue.slice(dotIndex + 1).toLowerCase();
}

function getExtensionFromUri(uri: string): string | undefined {
  try {
    const parsedUrl = new URL(uri);
    return getExtensionFromName(decodeURIComponent(parsedUrl.pathname));
  } catch {
    return getExtensionFromName(uri);
  }
}

function getMediaExtension(input: MediaCacheInput): string {
  return (
    getExtensionFromName(input.fileName) ??
    (input.mimeType ? MIME_TYPE_EXTENSIONS[input.mimeType.toLowerCase()] : undefined) ??
    getExtensionFromUri(input.uri) ??
    DEFAULT_EXTENSIONS[input.mediaType]
  );
}

function hashString(value: string): string {
  let hash = HASH_INITIAL_VALUE;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, HASH_MULTIPLIER);
  }

  return (hash >>> 0).toString(HASH_RADIX);
}

function sanitizeCacheKey(value: string): string {
  const sanitized = value
    .trim()
    .replace(/[?#].*$/g, "")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, MAX_SAFE_KEY_LENGTH);

  return sanitized.length > 0 ? sanitized : "media";
}

function getStableUriCacheKey(uri: string): string {
  try {
    const parsedUrl = new URL(uri);
    return `${parsedUrl.hostname}${decodeURIComponent(parsedUrl.pathname)}`;
  } catch {
    return uri.split("?")[0].split("#")[0];
  }
}

function getCacheKey(input: MediaCacheInput): string {
  const sourceKey = input.cacheKey?.trim() || getStableUriCacheKey(input.uri);
  const hash = hashString(sourceKey);
  const safeKey = sanitizeCacheKey(sourceKey);

  return `${safeKey}-${hash}`;
}

function getMediaCacheDirectory(mediaType: MediaCacheType): Directory {
  const directory = new Directory(Paths.cache, CACHE_DIRECTORY_NAME, mediaType);
  directory.create({ idempotent: true, intermediates: true });

  return directory;
}

function getCacheFile(input: MediaCacheInput): ExpoFile {
  const directory = getMediaCacheDirectory(input.mediaType);
  const extension = getMediaExtension(input);

  return new ExpoFile(directory, `${getCacheKey(input)}.${extension}`);
}

function isUsableFile(file: ExpoFile): boolean {
  try {
    const info = file.info();

    return info.exists && (info.size ?? file.size) > 0;
  } catch {
    return false;
  }
}

function deleteFileSafely(file: ExpoFile): void {
  try {
    if (file.exists) {
      file.delete();
    }
  } catch {
    // Best-effort cleanup only; callers can still fall back to remote media.
  }
}

function getVerifiedLocalUri(uri: string): string | null {
  const file = new ExpoFile(uri);

  return isUsableFile(file) ? file.uri : null;
}

async function downloadRemoteMediaAsync(input: MediaCacheInput, destination: ExpoFile): Promise<string> {
  deleteFileSafely(destination);

  await ExpoFile.downloadFileAsync(input.uri, destination, { idempotent: true });

  if (!isUsableFile(destination)) {
    deleteFileSafely(destination);
    throw new Error("Downloaded media cache file is empty.");
  }

  return destination.uri;
}

export async function cacheRemoteMediaAsync(input: MediaCacheInput): Promise<string> {
  const trimmedUri = input.uri.trim();

  if (FILE_URI_PATTERN.test(trimmedUri)) {
    return getVerifiedLocalUri(trimmedUri) ?? trimmedUri;
  }

  if (!REMOTE_URI_PATTERN.test(trimmedUri)) {
    throw new Error("Only remote HTTP media can be cached.");
  }

  const destination = getCacheFile({ ...input, uri: trimmedUri });

  if (isUsableFile(destination)) {
    return destination.uri;
  }

  deleteFileSafely(destination);

  const pendingKey = destination.uri;
  const pendingDownload = pendingDownloads.get(pendingKey);

  if (pendingDownload) {
    return pendingDownload;
  }

  const downloadPromise = downloadRemoteMediaAsync({ ...input, uri: trimmedUri }, destination)
    .finally(() => {
      pendingDownloads.delete(pendingKey);
    });

  pendingDownloads.set(pendingKey, downloadPromise);

  return downloadPromise;
}

export async function getCachedMediaUriAsync(input: MediaCacheInput): Promise<string> {
  const trimmedUri = input.uri.trim();

  if (trimmedUri.length === 0) {
    return input.uri;
  }

  if (FILE_URI_PATTERN.test(trimmedUri)) {
    return getVerifiedLocalUri(trimmedUri) ?? trimmedUri;
  }

  if (!REMOTE_URI_PATTERN.test(trimmedUri)) {
    return trimmedUri;
  }

  try {
    return await cacheRemoteMediaAsync({ ...input, uri: trimmedUri });
  } catch (error) {
    if (__DEV__) {
      console.warn("[mediaCache] Falling back to remote media URI", error);
    }
    return trimmedUri;
  }
}

export async function clearOldMediaCacheAsync(
  maxAgeMs: number = DEFAULT_CACHE_MAX_AGE_MS,
): Promise<void> {
  const now = Date.now();

  for (const mediaType of MEDIA_CACHE_TYPES) {
    const directory = getMediaCacheDirectory(mediaType);

    for (const entry of directory.list()) {
      if (!(entry instanceof ExpoFile)) {
        continue;
      }

      try {
        const info = entry.info();
        const timestamp = info.modificationTime ?? info.creationTime;

        if (timestamp !== undefined && now - timestamp > maxAgeMs) {
          entry.delete();
        }
      } catch {
        deleteFileSafely(entry);
      }
    }
  }
}
