import { Directory, File as ExpoFile, Paths } from "expo-file-system";
import { copyAsync } from "expo-file-system/legacy";
import { isValidFile, trim } from "react-native-video-trim";

import type { VideoTrimRange } from "@/types/chatMedia";
import { cacheRemoteMediaAsync } from "@/utils/mediaCache";

const FILE_URI_PREFIX = "file://";
const REMOTE_URI_PATTERN = /^https?:\/\//i;
const TRIM_CACHE_DIRECTORY_NAME = "chat-video-trim-cache";
const DEFAULT_VIDEO_FILE_NAME = "video.mp4";
const DEFAULT_VIDEO_MIME_TYPE = "video/mp4";
const DEFAULT_VIDEO_EXTENSION = "mp4";
const OUTPUT_VIDEO_EXTENSIONS = new Set(["mp4", "mov"]);
const MIN_TRIM_DURATION_MS = 1000;
const UNIQUE_NAME_RADIX = 36;

const MIME_TYPE_EXTENSIONS: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/x-m4v": "m4v",
  "video/3gpp": "3gp",
};

const EXTENSION_MIME_TYPES: Record<string, string> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  m4v: "video/x-m4v",
  "3gp": "video/3gpp",
};

type DevLogValue = string | number | boolean | null | undefined;
type VideoFileValidation = Awaited<ReturnType<typeof isValidFile>>;

export type VideoTrimInput = {
  uri: string;
  fileName: string;
  mimeType: string;
  startMs: number;
  endMs: number;
  durationMs?: number;
};

export type VideoTrimResult = {
  uri: string;
  mimeType: string;
  fileName: string;
};

type EnsureLocalVideoFileForTrimInput = {
  uri: string;
  fileName: string;
  mimeType: string;
};

type LocalVideoFileForTrim = {
  uri: string;
  nativePath: string;
  fileName: string;
  mimeType: string;
  extension: string;
  size: number;
  normalizedSourceUri: string;
};

export function hasVideoTrimChanged(
  range: VideoTrimRange,
  durationMs: number | undefined,
): boolean {
  if (!durationMs || durationMs <= 0) {
    return false;
  }

  return range.startMs > 0 || range.endMs < durationMs;
}

export function getUriWithoutHash(uri: string): string {
  return uri.trim().split("#")[0];
}

export function isRemoteUri(uri: string): boolean {
  return REMOTE_URI_PATTERN.test(uri.trim());
}

export function isLocalFileUri(uri: string): boolean {
  return uri.trim().startsWith(FILE_URI_PREFIX);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function redactUriForLog(uri: string): string {
  const trimmedUri = uri.trim();

  if (trimmedUri.length === 0) {
    return trimmedUri;
  }

  try {
    const parsedUrl = new URL(trimmedUri);
    parsedUrl.search = parsedUrl.search ? "?<redacted>" : "";
    parsedUrl.hash = parsedUrl.hash ? "#<redacted>" : "";
    return parsedUrl.toString();
  } catch {
    return trimmedUri.split("?")[0].split("#")[0];
  }
}

function devLog(message: string, details: Record<string, DevLogValue>): void {
  if (__DEV__) {
    console.info(`[videoTrim] ${message}`, details);
  }
}

function decodeFilePath(filePath: string): string {
  try {
    return decodeURI(filePath);
  } catch {
    return filePath;
  }
}

function toNativeFilePath(uri: string): string {
  return decodeFilePath(uri.startsWith(FILE_URI_PREFIX) ? uri.slice(FILE_URI_PREFIX.length) : uri);
}

function toFileUri(pathOrUri: string): string {
  if (pathOrUri.startsWith(FILE_URI_PREFIX)) {
    return pathOrUri;
  }

  if (pathOrUri.startsWith("/")) {
    return `${FILE_URI_PREFIX}${pathOrUri}`;
  }

  throw new Error("Video trim returned an unsupported output path.");
}

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

export function getVideoFileExtension(
  uri: string,
  mimeType: string | undefined,
  fileName?: string,
): string {
  return (
    getExtensionFromName(fileName) ??
    (mimeType ? MIME_TYPE_EXTENSIONS[mimeType.toLowerCase()] : undefined) ??
    getExtensionFromUri(uri) ??
    DEFAULT_VIDEO_EXTENSION
  );
}

function getOutputExtension(inputExtension: string): string {
  return OUTPUT_VIDEO_EXTENSIONS.has(inputExtension) ? inputExtension : DEFAULT_VIDEO_EXTENSION;
}

function getMimeTypeForExtension(extension: string, fallbackMimeType: string): string {
  return EXTENSION_MIME_TYPES[extension] ?? fallbackMimeType;
}

function sanitizeFileName(fileName: string, extension: string): string {
  const sourceName = fileName.trim().length > 0 ? fileName.trim() : DEFAULT_VIDEO_FILE_NAME;
  const withoutQuery = sourceName.split("?")[0].split("#")[0];
  const sanitized = withoutQuery
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .replace(/^[-.]+|[-.]+$/g, "");

  if (sanitized.length === 0) {
    return `video.${extension}`;
  }

  return getExtensionFromName(sanitized) ? sanitized : `${sanitized}.${extension}`;
}

function createCacheFileName(fileName: string, extension: string): string {
  const safeName = sanitizeFileName(fileName, extension);
  const dotIndex = safeName.lastIndexOf(".");
  const baseName = dotIndex > 0 ? safeName.slice(0, dotIndex) : safeName;
  const uniqueSuffix = Date.now().toString(UNIQUE_NAME_RADIX);

  return `${baseName}-${uniqueSuffix}.${extension}`;
}

function getTrimmedFileName(fileName: string, extension: string): string {
  const safeName = sanitizeFileName(fileName, extension);
  const dotIndex = safeName.lastIndexOf(".");
  const baseName = dotIndex > 0 ? safeName.slice(0, dotIndex) : safeName;

  return `trimmed-${baseName || "video"}.${extension}`;
}

function getTrimCacheDirectory(): Directory {
  const directory = new Directory(Paths.cache, TRIM_CACHE_DIRECTORY_NAME);
  directory.create({ idempotent: true, intermediates: true });

  return directory;
}

function normalizeVideoUri(uri: string): string {
  const trimmedUri = getUriWithoutHash(uri);

  if (trimmedUri.length === 0) {
    throw new Error("Unsupported video URI");
  }

  if (trimmedUri.startsWith("/")) {
    return `${FILE_URI_PREFIX}${trimmedUri}`;
  }

  return trimmedUri;
}

function getCopySourceUri(uri: string): string {
  return uri.startsWith("/") ? `${FILE_URI_PREFIX}${uri}` : uri;
}

function verifyLocalVideoFile(uri: string, missingMessage: string, emptyMessage: string): number {
  if (!isLocalFileUri(uri)) {
    throw new Error("Video source must be local before trimming");
  }

  const file = new ExpoFile(uri);
  const info = file.info();

  if (!info.exists) {
    throw new Error(missingMessage);
  }

  const size = info.size ?? file.size;

  if (!Number.isFinite(size) || size <= 0) {
    throw new Error(emptyMessage);
  }

  return size;
}

export async function ensureLocalVideoFileForTrimAsync(
  input: EnsureLocalVideoFileForTrimInput,
): Promise<LocalVideoFileForTrim> {
  const normalizedSourceUri = normalizeVideoUri(input.uri);
  let sourceUri = normalizedSourceUri;

  if (isRemoteUri(normalizedSourceUri)) {
    sourceUri = await cacheRemoteMediaAsync({
      uri: normalizedSourceUri,
      mediaType: "video",
      mimeType: input.mimeType,
      fileName: input.fileName,
    });
  }

  if (isRemoteUri(sourceUri)) {
    throw new Error("Video source must be local before trimming");
  }

  const extension = getVideoFileExtension(sourceUri, input.mimeType, input.fileName);
  const cacheDirectory = getTrimCacheDirectory();
  const destination = new ExpoFile(
    cacheDirectory,
    createCacheFileName(input.fileName || DEFAULT_VIDEO_FILE_NAME, extension),
  );

  try {
    await copyAsync({
      from: getCopySourceUri(sourceUri),
      to: destination.uri,
    });
  } catch (error) {
    devLog("failed to copy video into trim cache", {
      sourceUri: redactUriForLog(sourceUri),
      destinationUri: redactUriForLog(destination.uri),
      error: getErrorMessage(error),
    });
    throw new Error("Unsupported video URI");
  }

  const size = verifyLocalVideoFile(
    destination.uri,
    "Video file does not exist",
    "Video file is empty",
  );

  return {
    uri: destination.uri,
    nativePath: toNativeFilePath(destination.uri),
    fileName: destination.name,
    mimeType: getMimeTypeForExtension(extension, input.mimeType),
    extension,
    size,
    normalizedSourceUri,
  };
}

async function getValidatedTrimInputPath(
  localFile: LocalVideoFileForTrim,
): Promise<{ trimInputPath: string; validation: VideoFileValidation }> {
  const candidates = Array.from(new Set([localFile.nativePath, localFile.uri]));
  let lastValidation: VideoFileValidation | null = null;
  let lastErrorMessage: string | null = null;

  for (const candidate of candidates) {
    try {
      const validation = await isValidFile(candidate);
      lastValidation = validation;

      devLog("validated trim candidate", {
        candidate: redactUriForLog(candidate),
        isValid: validation.isValid,
        fileType: validation.fileType,
        durationMs: validation.duration,
      });

      if (validation.isValid && validation.fileType === "video") {
        return { trimInputPath: candidate, validation };
      }
    } catch (error) {
      lastErrorMessage = getErrorMessage(error);
      devLog("trim candidate validation failed", {
        candidate: redactUriForLog(candidate),
        error: lastErrorMessage,
      });
    }
  }

  if (lastValidation) {
    throw new Error(
      `Video source is not a valid video file (type: ${lastValidation.fileType || "unknown"}, duration: ${lastValidation.duration || 0}ms).`,
    );
  }

  throw new Error(lastErrorMessage ?? "Video source is not a valid video file.");
}

export function verifyVideoFileAsync(uri: string): Promise<number> {
  return Promise.resolve(
    verifyLocalVideoFile(uri, "Video file does not exist", "Video file is empty"),
  );
}

export async function trimVideoAsync(input: VideoTrimInput): Promise<VideoTrimResult> {
  const startMs = Math.max(0, Math.round(input.startMs));
  let endMs = Math.round(input.endMs);

  if (endMs - startMs < MIN_TRIM_DURATION_MS) {
    throw new Error("Video trim range must be at least 1 second.");
  }

  try {
    const localFile = await ensureLocalVideoFileForTrimAsync({
      uri: input.uri,
      fileName: input.fileName,
      mimeType: input.mimeType,
    });
    const { trimInputPath, validation } = await getValidatedTrimInputPath(localFile);
    const validationDurationMs = validation.duration > 0 ? Math.round(validation.duration) : undefined;

    if (validationDurationMs && endMs > validationDurationMs) {
      endMs = validationDurationMs;
    }

    if (endMs - startMs < MIN_TRIM_DURATION_MS) {
      throw new Error("Video trim range must be at least 1 second.");
    }

    const outputExtension = getOutputExtension(localFile.extension);

    devLog("starting trim", {
      originalUri: redactUriForLog(input.uri),
      normalizedUri: redactUriForLog(localFile.normalizedSourceUri),
      localFileUri: redactUriForLog(localFile.uri),
      trimInputPath: redactUriForLog(trimInputPath),
      extension: localFile.extension,
      size: localFile.size,
      durationMs: input.durationMs ?? validationDurationMs,
      trimStartMs: startMs,
      trimEndMs: endMs,
    });

    const result = await trim(trimInputPath, {
      startTime: startMs,
      endTime: endMs,
      saveToPhoto: false,
      type: "video",
      outputExt: outputExtension,
      enablePreciseTrimming: true,
      removeAudio: false,
    });

    if (!result.success || result.outputPath.trim().length === 0) {
      throw new Error("Video trim export did not return an output file.");
    }

    const outputUri = toFileUri(result.outputPath);
    const outputSize = verifyLocalVideoFile(
      outputUri,
      "Trimmed video file does not exist",
      "Trimmed video file is empty",
    );

    devLog("trim finished", {
      outputUri: redactUriForLog(outputUri),
      outputSize,
      outputExtension,
    });

    return {
      uri: outputUri,
      fileName: getTrimmedFileName(input.fileName, outputExtension),
      mimeType: getMimeTypeForExtension(outputExtension, DEFAULT_VIDEO_MIME_TYPE),
    };
  } catch (error) {
    const message = getErrorMessage(error);
    devLog("trim failed", {
      originalUri: redactUriForLog(input.uri),
      normalizedUri: redactUriForLog(getUriWithoutHash(input.uri)),
      trimStartMs: startMs,
      trimEndMs: endMs,
      error: message,
    });
    throw new Error(`Failed to trim video: ${message}`);
  }
}
