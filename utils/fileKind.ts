export type FileKind = "image" | "video" | "pdf" | "document";

export type FileClassificationInput = {
  fileName?: string | null;
  mimeType?: string | null;
  uri?: string | null;
};

const DEFAULT_FILE_NAME = "file";
const FILE_NAME_MAX_LENGTH = 120;

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "m4v"]);
const PDF_EXTENSIONS = new Set(["pdf"]);

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const VIDEO_MIME_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/mov",
  "video/x-m4v",
]);

const PDF_MIME_TYPES = new Set(["application/pdf"]);

const MIME_TYPE_EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mov": "mov",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/x-m4v": "m4v",
};

export function normalizeMimeType(mimeType?: string | null): string {
  return mimeType?.trim().toLowerCase().split(";")[0] ?? "";
}

export function getFileExtension(fileName?: string | null): string {
  if (!fileName) return "";
  const cleanFileName = fileName.trim().split("?")[0].split("#")[0];
  const dotIndex = cleanFileName.lastIndexOf(".");

  if (dotIndex <= 0 || dotIndex === cleanFileName.length - 1) {
    return "";
  }

  return cleanFileName.slice(dotIndex + 1).toLowerCase();
}

export function getFileNameFromUri(uri?: string | null): string {
  if (!uri) return "";

  try {
    const parsedUrl = new URL(uri);
    const pathName = decodeURIComponent(parsedUrl.pathname);
    return pathName.split("/").filter(Boolean).pop() ?? "";
  } catch {
    const cleanUri = uri.trim().split("?")[0].split("#")[0];
    return cleanUri.split("/").filter(Boolean).pop() ?? "";
  }
}

export function getFileExtensionFromUri(uri?: string | null): string {
  return getFileExtension(getFileNameFromUri(uri));
}

export function getFileExtensionFromMimeType(mimeType?: string | null): string {
  return MIME_TYPE_EXTENSIONS[normalizeMimeType(mimeType)] ?? "";
}

export function getFileExtensionFromMetadata(input: FileClassificationInput): string {
  return (
    getFileExtension(input.fileName) ||
    getFileExtensionFromUri(input.uri) ||
    getFileExtensionFromMimeType(input.mimeType)
  );
}

function getKindFromExtension(extension: string): FileKind | undefined {
  if (IMAGE_EXTENSIONS.has(extension)) return "image";
  if (VIDEO_EXTENSIONS.has(extension)) return "video";
  if (PDF_EXTENSIONS.has(extension)) return "pdf";

  return undefined;
}

function getKindFromMimeType(mimeType: string): FileKind | undefined {
  if (IMAGE_MIME_TYPES.has(mimeType)) return "image";
  if (VIDEO_MIME_TYPES.has(mimeType)) return "video";
  if (PDF_MIME_TYPES.has(mimeType)) return "pdf";

  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";

  return undefined;
}

export function classifyFileKind(input: FileClassificationInput): FileKind {
  const extensionKind = getKindFromExtension(getFileExtensionFromMetadata(input));

  if (extensionKind) {
    return extensionKind;
  }

  return getKindFromMimeType(normalizeMimeType(input.mimeType)) ?? "document";
}

export function isPdfFile(input: FileClassificationInput): boolean {
  return classifyFileKind(input) === "pdf";
}

export function getDisplayFileName(input: FileClassificationInput, fallbackBaseName: string = DEFAULT_FILE_NAME): string {
  const explicitName = input.fileName?.trim();

  if (explicitName) {
    return explicitName;
  }

  const uriFileName = getFileNameFromUri(input.uri);

  if (uriFileName) {
    return uriFileName;
  }

  const extension = getFileExtensionFromMetadata(input);
  const safeBaseName = fallbackBaseName.trim().slice(0, FILE_NAME_MAX_LENGTH) || DEFAULT_FILE_NAME;

  return extension ? `${safeBaseName}.${extension}` : safeBaseName;
}
