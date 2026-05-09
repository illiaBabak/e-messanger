import { Ionicons } from "@expo/vector-icons";

export function formatFileSize(bytes?: number): string {
  if (bytes === undefined || bytes === null || isNaN(bytes)) return "Unknown size";
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function getFileExtension(fileName: string): string {
  if (!fileName) return "";
  const parts = fileName.split(".");
  if (parts.length === 1 || (parts[0] === "" && parts.length === 2)) {
    return "";
  }
  return parts.pop()?.toLowerCase() || "";
}

export function getFileIconByMimeType(mimeType?: string, fileName?: string): keyof typeof Ionicons.glyphMap {
  const type = mimeType?.toLowerCase() || "";
  const ext = fileName ? getFileExtension(fileName) : "";

  if (type.includes("pdf") || ext === "pdf") return "document-text";
  if (type.includes("image") || ["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return "image";
  if (type.includes("video") || ["mp4", "mov", "avi", "mkv"].includes(ext)) return "videocam";
  if (type.includes("audio") || ["mp3", "wav", "m4a", "ogg"].includes(ext)) return "musical-notes";
  if (type.includes("zip") || type.includes("tar") || type.includes("compressed") || ["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "archive";
  if (type.includes("excel") || type.includes("spreadsheet") || ["xls", "xlsx", "csv"].includes(ext)) return "stats-chart";
  if (type.includes("word") || ["doc", "docx"].includes(ext)) return "document-text";
  if (type.includes("presentation") || ["ppt", "pptx"].includes(ext)) return "easel";
  
  return "document";
}
