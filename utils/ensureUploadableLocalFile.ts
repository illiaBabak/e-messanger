import { Directory, File, Paths } from "expo-file-system";
import { copyAsync } from "expo-file-system/legacy";

const FILE_URI_PREFIX = "file://";
const HTTP_URI_PATTERN = /^https?:\/\//i;
const CACHE_DIRECTORY_NAME = "chat-upload-cache";
const DEFAULT_FILE_EXTENSION = "bin";
const DEFAULT_VIDEO_EXTENSION = "mp4";
const UNIQUE_NAME_RADIX = 36;

const MIME_TYPE_EXTENSIONS: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/x-m4v": "m4v",
  "video/3gpp": "3gp",
};

export type EnsureUploadableLocalFileInput = {
  uri: string;
  fileName: string;
  mimeType: string;
};

export type EnsureUploadableLocalFileResult = {
  uri: string;
  fileName: string;
  mimeType: string;
  size?: number;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function getExtensionFromFileName(fileName: string): string | undefined {
  const trimmedName = fileName.trim();
  const dotIndex = trimmedName.lastIndexOf(".");

  if (dotIndex <= 0 || dotIndex === trimmedName.length - 1) {
    return undefined;
  }

  return trimmedName.slice(dotIndex + 1).toLowerCase();
}

function getExtension(input: EnsureUploadableLocalFileInput): string {
  return (
    getExtensionFromFileName(input.fileName) ??
    MIME_TYPE_EXTENSIONS[input.mimeType.toLowerCase()] ??
    DEFAULT_VIDEO_EXTENSION
  );
}

function sanitizeFileName(fileName: string, extension: string): string {
  const trimmedName = fileName.trim();
  const fallbackName = `media.${extension || DEFAULT_FILE_EXTENSION}`;
  const sourceName = trimmedName.length > 0 ? trimmedName : fallbackName;
  const withoutQuery = sourceName.split("?")[0].split("#")[0];
  const sanitized = withoutQuery
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .replace(/^[-.]+|[-.]+$/g, "");

  if (sanitized.length === 0) {
    return fallbackName;
  }

  return getExtensionFromFileName(sanitized) ? sanitized : `${sanitized}.${extension}`;
}

function createCacheFileName(input: EnsureUploadableLocalFileInput): string {
  const extension = getExtension(input);
  const safeName = sanitizeFileName(input.fileName, extension);
  const dotIndex = safeName.lastIndexOf(".");
  const baseName = dotIndex > 0 ? safeName.slice(0, dotIndex) : safeName;
  const fileExtension = dotIndex > 0 ? safeName.slice(dotIndex + 1) : extension;
  const uniqueSuffix = Date.now().toString(UNIQUE_NAME_RADIX);

  return `${baseName}-${uniqueSuffix}.${fileExtension}`;
}

function getUploadCacheDirectory(): Directory {
  const directory = new Directory(Paths.cache, CACHE_DIRECTORY_NAME);
  directory.create({ idempotent: true, intermediates: true });
  return directory;
}

async function copyToUploadCacheAsync(
  input: EnsureUploadableLocalFileInput,
): Promise<EnsureUploadableLocalFileResult> {
  const cacheDirectory = getUploadCacheDirectory();
  const destination = new File(cacheDirectory, createCacheFileName(input));

  try {
    await copyAsync({ from: input.uri, to: destination.uri });
  } catch (error) {
    throw new Error(`Failed to copy media into upload cache: ${getErrorMessage(error)}`);
  }

  const info = destination.info();

  if (!info.exists) {
    throw new Error("Media copy finished, but the cached file does not exist.");
  }

  return {
    uri: destination.uri,
    fileName: destination.name,
    mimeType: input.mimeType,
    ...(info.size !== undefined && { size: info.size }),
  };
}

export function getUriWithoutHash(uri: string): string {
  return uri.trim().split("#")[0];
}

export async function ensureUploadableLocalFileAsync(
  input: EnsureUploadableLocalFileInput,
): Promise<EnsureUploadableLocalFileResult> {
  const trimmedUri = getUriWithoutHash(input.uri)

  if (trimmedUri.length === 0) {
    throw new Error("Invalid media URI: the URI is empty.");
  }

  if (HTTP_URI_PATTERN.test(trimmedUri)) {
    throw new Error("Invalid media URI: remote URLs cannot be uploaded as local files.");
  }

  return copyToUploadCacheAsync({
    ...input,
    uri: trimmedUri,
  });
}