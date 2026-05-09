import { File } from "expo-file-system";
import { isValidFile, trim } from "react-native-video-trim";

import type { VideoTrimRange } from "@/types/chatMedia";
import { ensureUploadableLocalFileAsync } from "@/utils/ensureUploadableLocalFile";

const FILE_URI_PREFIX = "file://";
const DEFAULT_VIDEO_FILE_NAME = "video.mp4";
const DEFAULT_VIDEO_MIME_TYPE = "video/mp4";
const OUTPUT_VIDEO_EXTENSION = "mp4";
const MIN_TRIM_DURATION_MS = 1000;

export type VideoTrimInput = {
  uri: string;
  fileName: string;
  mimeType: string;
  startMs: number;
  endMs: number;
};

export type VideoTrimResult = {
  uri: string;
  mimeType: string;
  fileName: string;
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

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
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

  throw new Error(`Video trim returned an unsupported output path: ${pathOrUri}`);
}

function getTrimmedFileName(fileName: string): string {
  const sourceName = fileName.trim().length > 0 ? fileName.trim() : DEFAULT_VIDEO_FILE_NAME;
  const withoutQuery = sourceName.split("?")[0].split("#")[0];
  const dotIndex = withoutQuery.lastIndexOf(".");
  const baseName = dotIndex > 0 ? withoutQuery.slice(0, dotIndex) : withoutQuery;
  const safeBaseName = baseName
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .replace(/^[-.]+|[-.]+$/g, "");

  return `trimmed-${safeBaseName || "video"}.${OUTPUT_VIDEO_EXTENSION}`;
}

function verifyExistingFile(uri: string): void {
  const file = new File(uri);
  const info = file.info();

  if (!info.exists) {
    throw new Error(`Trimmed video file does not exist: ${uri}`);
  }
}

export async function trimVideoAsync(input: VideoTrimInput): Promise<VideoTrimResult> {
  const startMs = Math.max(0, Math.round(input.startMs));
  const endMs = Math.round(input.endMs);

  if (endMs - startMs < MIN_TRIM_DURATION_MS) {
    throw new Error("Video trim range must be at least 1 second.");
  }

  const uploadableInput = await ensureUploadableLocalFileAsync({
    uri: input.uri,
    fileName: input.fileName,
    mimeType: input.mimeType,
  });
  const nativeInputPath = toNativeFilePath(uploadableInput.uri);

  try {
    const validation = await isValidFile(nativeInputPath);

    if (!validation.isValid || validation.fileType !== "video") {
      throw new Error("Selected file is not a valid video.");
    }

    const result = await trim(nativeInputPath, {
      startTime: startMs,
      endTime: endMs,
      saveToPhoto: false,
      type: "video",
      outputExt: OUTPUT_VIDEO_EXTENSION,
      enablePreciseTrimming: true,
      removeAudio: false,
    });

    if (!result.success || result.outputPath.trim().length === 0) {
      throw new Error("Video trim export did not return an output file.");
    }

    const outputUri = toFileUri(result.outputPath);
    verifyExistingFile(outputUri);

    return {
      uri: outputUri,
      fileName: getTrimmedFileName(input.fileName),
      mimeType: DEFAULT_VIDEO_MIME_TYPE,
    };
  } catch (error) {
    throw new Error(`Failed to trim video: ${getErrorMessage(error)}`);
  }
}
