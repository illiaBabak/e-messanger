import AsyncStorage from "@react-native-async-storage/async-storage";

const DOWNLOADED_MEDIA_KEY = "downloaded_media_records";
const MAX_DOWNLOADED_MEDIA_RECORDS = 100;

export type DownloadedMediaType = "photo" | "video";

export type DownloadedMediaRecord = {
  assetId: string;
  savedAt: number;
  type: DownloadedMediaType;
  fileName?: string;
  mimeType?: string;
};

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isDownloadedMediaType(value: unknown): value is DownloadedMediaType {
  return value === "photo" || value === "video";
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isDownloadedMediaRecord(value: unknown): value is DownloadedMediaRecord {
  if (!isRecordObject(value)) {
    return false;
  }

  return (
    typeof value.assetId === "string" &&
    value.assetId.trim().length > 0 &&
    typeof value.savedAt === "number" &&
    Number.isFinite(value.savedAt) &&
    isDownloadedMediaType(value.type) &&
    isOptionalString(value.fileName) &&
    isOptionalString(value.mimeType)
  );
}

export async function getDownloadedMediaRecords(): Promise<DownloadedMediaRecord[]> {
  const raw = await AsyncStorage.getItem(DOWNLOADED_MEDIA_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(isDownloadedMediaRecord)
      .sort((a, b) => b.savedAt - a.savedAt)
      .slice(0, MAX_DOWNLOADED_MEDIA_RECORDS);
  } catch {
    return [];
  }
}

export async function saveDownloadedMediaRecord(
  record: DownloadedMediaRecord,
): Promise<void> {
  const records = await getDownloadedMediaRecords();
  const withoutDuplicate = records.filter(item => item.assetId !== record.assetId);
  const nextRecords = [record, ...withoutDuplicate]
    .sort((a, b) => b.savedAt - a.savedAt)
    .slice(0, MAX_DOWNLOADED_MEDIA_RECORDS);

  await AsyncStorage.setItem(DOWNLOADED_MEDIA_KEY, JSON.stringify(nextRecords));
}

export async function removeDownloadedMediaRecords(assetIds: string[]): Promise<void> {
  if (assetIds.length === 0) {
    return;
  }

  const idsToRemove = new Set(assetIds);
  const records = await getDownloadedMediaRecords();
  const nextRecords = records.filter(record => !idsToRemove.has(record.assetId));

  await AsyncStorage.setItem(DOWNLOADED_MEDIA_KEY, JSON.stringify(nextRecords));
}
