import { Ionicons } from "@expo/vector-icons";

import {
  classifyFileKind,
  getFileExtension,
  normalizeMimeType,
} from "@/utils/fileKind";

export {
  classifyFileKind,
  getDisplayFileName,
  getFileExtension,
  getFileExtensionFromMetadata,
  getFileExtensionFromMimeType,
  getFileExtensionFromUri,
  getFileNameFromUri,
  isPdfFile,
  normalizeMimeType,
  type FileClassificationInput,
  type FileKind,
} from "@/utils/fileKind";

export function formatFileSize(bytes?: number): string {
  if (bytes === undefined || bytes === null || !Number.isFinite(bytes)) return "Unknown size";
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function getFileIconByMimeType(mimeType?: string, fileName?: string): keyof typeof Ionicons.glyphMap {
  const type = normalizeMimeType(mimeType);
  const ext = getFileExtension(fileName);
  const kind = classifyFileKind({ fileName, mimeType });

  if (kind === "pdf") return "document-text";
  if (kind === "image") return "image";
  if (kind === "video") return "videocam";
  if (type.includes("audio") || ["mp3", "wav", "m4a", "ogg"].includes(ext)) return "musical-notes";
  if (type.includes("zip") || type.includes("tar") || type.includes("compressed") || ["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "archive";
  if (type.includes("excel") || type.includes("spreadsheet") || ["xls", "xlsx", "csv"].includes(ext)) return "stats-chart";
  if (type.includes("word") || ["doc", "docx"].includes(ext)) return "document-text";
  if (type.includes("presentation") || ["ppt", "pptx"].includes(ext)) return "easel";
  
  return "document";
}
