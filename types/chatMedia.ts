export type ChatMediaKind = "image" | "video";

export type SelectedChatMedia = {
  uri: string;
  type: ChatMediaKind;
  fileName?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  duration?: number;
  fileSize?: number;
};

export type VideoTrimRange = {
  startMs: number;
  endMs: number;
};

export type ChatVideo = {
  mediaType: "video";
  url: string;
  fileName: string;
  mimeType: string;
  size?: number;
  duration?: number;
  width?: number;
  height?: number;
};
