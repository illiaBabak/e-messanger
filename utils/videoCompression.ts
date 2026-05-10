import { File } from "expo-file-system";
import { Video } from "react-native-compressor";

import { ensureUploadableLocalFileAsync, getUriWithoutHash } from "@/utils/ensureUploadableLocalFile";

const FILE_URI_PREFIX = "file://";
const DEFAULT_VIDEO_FILE_NAME = "video.mp4";
const DEFAULT_VIDEO_MIME_TYPE = "video/mp4";
const OUTPUT_VIDEO_EXTENSION = "mp4";
const FALLBACK_VIDEO_NAME = "video";
const BYTES_PER_MEGABYTE = 1024 * 1024;
const VIDEO_COMPRESSION_THRESHOLD_MB = 12;
const MAX_VIDEO_UPLOAD_MB = 50;
const VIDEO_COMPRESSION_MAX_DIMENSION = 1280;
const VIDEO_COMPRESSION_PROGRESS_DIVIDER = 10;
const FULL_SIZE_RATIO = 1;
const MEGABYTE_DECIMALS = 1;

export const VIDEO_COMPRESSION_THRESHOLD_BYTES =
  VIDEO_COMPRESSION_THRESHOLD_MB * BYTES_PER_MEGABYTE;
export const MAX_VIDEO_UPLOAD_BYTES = MAX_VIDEO_UPLOAD_MB * BYTES_PER_MEGABYTE;

export type VideoCompressionInput = {
  uri: string;
  fileName?: string;
  mimeType?: string;
  onProgress?: (progress: number) => void;
};

export type VideoCompressionResult = {
  uri: string;
  fileName: string;
  mimeType: string;
  size: number;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  wasCompressed: boolean;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function formatMegabytes(bytes: number): string {
  return (bytes / BYTES_PER_MEGABYTE).toFixed(MEGABYTE_DECIMALS);
}

function isVerifiedFileSize(size: number | undefined): size is number {
  return typeof size === "number" && Number.isFinite(size) && size > 0;
}

function normalizeLocalFileUri(pathOrUri: string): string {
  const cleanUri = getUriWithoutHash(pathOrUri).trim();

  if (cleanUri.length === 0) {
    throw new Error("Invalid video URI: the URI is empty.");
  }

  if (cleanUri.startsWith(FILE_URI_PREFIX)) {
    return cleanUri;
  }

  if (cleanUri.startsWith("/")) {
    return `${FILE_URI_PREFIX}${cleanUri}`;
  }

  throw new Error(`Unsupported local video URI: ${cleanUri}`);
}

function getExistingVideoFileSize(uri: string, label: string): number {
  const file = new File(uri);
  const info = file.info();

  if (!info.exists) {
    throw new Error(`The ${label} video file does not exist.`);
  }

  if (!isVerifiedFileSize(info.size)) {
    throw new Error(`The ${label} video file size could not be verified.`);
  }

  return info.size;
}

export function assertVideoUploadSize(size: number): void {
  if (!isVerifiedFileSize(size)) {
    throw new Error("Video file size could not be verified.");
  }

  if (size <= MAX_VIDEO_UPLOAD_BYTES) {
    return;
  }

  throw new Error(
    `Video is too large to upload (${formatMegabytes(size)} MB). Please choose a video under ${formatMegabytes(MAX_VIDEO_UPLOAD_BYTES)} MB.`,
  );
}

function getCompressionRatio(finalSize: number, originalSize: number): number {
  return originalSize > 0 ? finalSize / originalSize : FULL_SIZE_RATIO;
}

function getBaseFileName(fileName: string | undefined): string {
  const sourceName =
    fileName && fileName.trim().length > 0 ? fileName.trim() : DEFAULT_VIDEO_FILE_NAME;
  const cleanName = sourceName.split("?")[0].split("#")[0];
  const dotIndex = cleanName.lastIndexOf(".");
  const baseName = dotIndex > 0 ? cleanName.slice(0, dotIndex) : cleanName;
  const safeBaseName = baseName
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .replace(/^[-.]+|[-.]+$/g, "");

  return safeBaseName || FALLBACK_VIDEO_NAME;
}

function getCompressedFileName(fileName: string | undefined): string {
  return `${getBaseFileName(fileName)}.${OUTPUT_VIDEO_EXTENSION}`;
}

function buildResult(input: {
  uri: string;
  fileName: string;
  mimeType: string;
  size: number;
  originalSize: number;
  compressedSize: number;
  wasCompressed: boolean;
}): VideoCompressionResult {
  return {
    uri: input.uri,
    fileName: input.fileName,
    mimeType: input.mimeType,
    size: input.size,
    originalSize: input.originalSize,
    compressedSize: input.compressedSize,
    compressionRatio: getCompressionRatio(input.size, input.originalSize),
    wasCompressed: input.wasCompressed,
  };
}

export async function compressVideoForUploadAsync(
  input: VideoCompressionInput,
): Promise<VideoCompressionResult> {
  const uploadableVideo = await ensureUploadableLocalFileAsync({
    uri: input.uri,
    fileName: input.fileName ?? DEFAULT_VIDEO_FILE_NAME,
    mimeType: input.mimeType ?? DEFAULT_VIDEO_MIME_TYPE,
  });
  const sourceUri = normalizeLocalFileUri(uploadableVideo.uri);
  const originalSize = isVerifiedFileSize(uploadableVideo.size)
    ? uploadableVideo.size
    : getExistingVideoFileSize(sourceUri, "original");

  if (originalSize <= VIDEO_COMPRESSION_THRESHOLD_BYTES) {
    assertVideoUploadSize(originalSize);

    return buildResult({
      uri: sourceUri,
      fileName: uploadableVideo.fileName,
      mimeType: uploadableVideo.mimeType,
      size: originalSize,
      originalSize,
      compressedSize: originalSize,
      wasCompressed: false,
    });
  }

  let compressedUri: string;

  try {
    compressedUri = await Video.compress(
      sourceUri,
      {
        compressionMethod: "auto",
        maxSize: VIDEO_COMPRESSION_MAX_DIMENSION,
        minimumFileSizeForCompress: VIDEO_COMPRESSION_THRESHOLD_MB,
        progressDivider: VIDEO_COMPRESSION_PROGRESS_DIVIDER,
      },
      input.onProgress,
    );
  } catch (error) {
    throw new Error(`Failed to compress video: ${getErrorMessage(error)}`);
  }

  const normalizedCompressedUri = normalizeLocalFileUri(compressedUri);
  const compressedSize = getExistingVideoFileSize(normalizedCompressedUri, "compressed");
  const shouldUseCompressedVideo = compressedSize < originalSize;
  const finalSize = shouldUseCompressedVideo ? compressedSize : originalSize;

  assertVideoUploadSize(finalSize);

  return buildResult({
    uri: shouldUseCompressedVideo ? normalizedCompressedUri : sourceUri,
    fileName: shouldUseCompressedVideo
      ? getCompressedFileName(uploadableVideo.fileName)
      : uploadableVideo.fileName,
    mimeType: shouldUseCompressedVideo ? DEFAULT_VIDEO_MIME_TYPE : uploadableVideo.mimeType,
    size: finalSize,
    originalSize,
    compressedSize,
    wasCompressed: shouldUseCompressedVideo,
  });
}
