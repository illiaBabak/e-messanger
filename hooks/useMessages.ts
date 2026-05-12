import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch
} from "@react-native-firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import type { ChatFile, ChatVideo, SelectedChatFile, SelectedChatMedia } from "@/types/chatMedia";
import { getDisplayFileName, getFileExtensionFromMetadata } from "@/utils/fileKind";
import { compressVideoForUploadAsync, type VideoCompressionResult } from "@/utils/videoCompression";
import { firestore } from "../services/firebase";
import { uploadFileMessage, uploadImageMessage, uploadVideoMessage, uploadVoiceMessage } from "../services/storage";

const DEFAULT_VIDEO_FILE_NAME = "video.mp4";
const DEFAULT_VIDEO_MIME_TYPE = "video/mp4";
const REMOTE_MEDIA_URI_PATTERN = /^https?:\/\//i;

export type ReplyToSnippet = {
  id: string;
  text: string;
  senderId: string;
};

export type PinnedMessage = {
  id: string;
  text: string;
  senderId: string;
};

export type Message = {
  id: string;
  text: string;
  senderId: string;
  createdAt: number;
  isRead: boolean;
  deletedFor?: string[];
  replyTo?: ReplyToSnippet;
  isForwarded?: boolean;
  isEdited?: boolean;
  audio?: {
    url: string;
    duration: number;
    waveform: number[];
  };
  images?: string[];
  file?: ChatFile;
  video?: ChatVideo;
  status?: "sending" | "sent" | "error";
};

export function getMessagePreviewText(message: Message | PinnedMessage | ReplyToSnippet | { text?: string; audio?: unknown; images?: unknown; file?: unknown; video?: unknown }): string {
  if ('images' in message && Array.isArray(message.images) && message.images.length > 0) {
    return "📷 Image";
  }
  if ('video' in message && message.video) {
    return "🎬 Video";
  }
  if ('audio' in message && message.audio) {
    return "🎤 Voice message";
  }
  if ('file' in message && message.file) {
    const file = message.file;

    if (isRecord(file)) {
      const mimeType = getOptionalString(file.mimeType);
      const fileName = getOptionalString(file.name) ?? getDisplayFileName({
        mimeType,
        uri: getOptionalString(file.url),
      });
      const extension = getFileExtensionFromMetadata({
        fileName,
        mimeType,
        uri: getOptionalString(file.url),
      }).toUpperCase();
      const prefix = extension === "PDF" ? "📄" : "📎";

      return `${prefix} ${fileName}`;
    }

    return "📎 File";
  }
  return message.text || "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function isRemoteMediaUri(uri: string): boolean {
  return REMOTE_MEDIA_URI_PATTERN.test(uri.trim());
}

function getChatVideoFromFirestore(value: unknown): ChatVideo | undefined {
  if (!isRecord(value) || typeof value.url !== "string") {
    return undefined;
  }

  const size = getOptionalNumber(value.size);
  const duration = getOptionalNumber(value.duration);
  const width = getOptionalNumber(value.width);
  const height = getOptionalNumber(value.height);
  const originalSize = getOptionalNumber(value.originalSize);
  const compressedSize = getOptionalNumber(value.compressedSize);
  const compressionRatio = getOptionalNumber(value.compressionRatio);

  return {
    mediaType: "video",
    url: value.url,
    fileName: typeof value.fileName === "string" ? value.fileName : DEFAULT_VIDEO_FILE_NAME,
    mimeType: typeof value.mimeType === "string" ? value.mimeType : DEFAULT_VIDEO_MIME_TYPE,
    ...(size !== undefined && { size }),
    ...(duration !== undefined && { duration }),
    ...(width !== undefined && { width }),
    ...(height !== undefined && { height }),
    ...(originalSize !== undefined && { originalSize }),
    ...(compressedSize !== undefined && { compressedSize }),
    ...(compressionRatio !== undefined && { compressionRatio }),
  };
}

function getChatFileFromFirestore(value: unknown): ChatFile | undefined {
  if (!isRecord(value) || typeof value.url !== "string") {
    return undefined;
  }

  const mimeType = getOptionalString(value.mimeType);
  const name = getOptionalString(value.name) ?? getOptionalString(value.fileName) ?? getDisplayFileName({
    mimeType,
    uri: value.url,
  });
  const size = getOptionalNumber(value.size);
  const storagePath = getOptionalString(value.storagePath);
  const storedExtension = getOptionalString(value.extension)?.toLowerCase();
  const extension =
    storedExtension ??
    getFileExtensionFromMetadata({
      fileName: name,
      mimeType,
      uri: value.url,
    });

  return {
    name,
    url: value.url,
    ...(mimeType !== undefined && { mimeType }),
    ...(size !== undefined && { size }),
    ...(storagePath !== undefined && { storagePath }),
    ...(extension.length > 0 && { extension }),
  };
}

function buildChatFilePayload(
  fileInfo: SelectedChatFile,
  url: string,
  storagePath?: string,
  uploadedExtension?: string,
): ChatFile {
  const extension =
    fileInfo.extension ||
    uploadedExtension ||
    getFileExtensionFromMetadata({
      fileName: fileInfo.name,
      mimeType: fileInfo.mimeType,
      uri: fileInfo.uri,
    });

  return {
    name: fileInfo.name,
    url,
    ...(fileInfo.mimeType !== undefined && { mimeType: fileInfo.mimeType }),
    ...(fileInfo.size !== undefined && { size: fileInfo.size }),
    ...(storagePath !== undefined && { storagePath }),
    ...(extension.length > 0 && { extension }),
  };
}

function buildChatVideoPayload(videoInfo: SelectedChatMedia, url: string): ChatVideo {
  return {
    mediaType: "video",
    url,
    fileName: videoInfo.fileName ?? DEFAULT_VIDEO_FILE_NAME,
    mimeType: videoInfo.mimeType ?? DEFAULT_VIDEO_MIME_TYPE,
    ...(videoInfo.fileSize !== undefined && { size: videoInfo.fileSize }),
    ...(videoInfo.duration !== undefined && { duration: videoInfo.duration }),
    ...(videoInfo.width !== undefined && { width: videoInfo.width }),
    ...(videoInfo.height !== undefined && { height: videoInfo.height }),
    ...(videoInfo.originalFileSize !== undefined && { originalSize: videoInfo.originalFileSize }),
    ...(videoInfo.compressedFileSize !== undefined && { compressedSize: videoInfo.compressedFileSize }),
    ...(videoInfo.compressionRatio !== undefined && { compressionRatio: videoInfo.compressionRatio }),
  };
}

function buildCompressedVideoInfo(
  videoInfo: SelectedChatMedia,
  compressionResult: VideoCompressionResult,
): SelectedChatMedia {
  return {
    ...videoInfo,
    uri: compressionResult.uri,
    fileName: compressionResult.fileName,
    mimeType: compressionResult.mimeType,
    fileSize: compressionResult.size,
    originalFileSize: compressionResult.originalSize,
    ...(compressionResult.wasCompressed && {
      compressedFileSize: compressionResult.compressedSize,
      compressionRatio: compressionResult.compressionRatio,
    }),
  };
}

export function useMessages(currentUserId: string | undefined | null, contactId: string | undefined) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [pendingMessages, setPendingMessages] = useState<Message[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessage[]>([]);
  const [isFriendTyping, setIsFriendTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const chatId = currentUserId && contactId 
    ? [currentUserId, contactId].sort().join("_") 
    : null;

  useEffect(() => {
    if (!chatId || !currentUserId) {
      setMessages([]);
      setPinnedMessages([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const messagesRef = collection(firestore, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot || snapshot.empty) {
          setMessages([]);
          setIsLoading(false);
          return;
        }

        const newMessages: Message[] = [];
        const unreadMessageIds: string[] = [];

        snapshot.docs.forEach((d) => {
          const data = d.data();
          const deletedFor = data.deletedFor || [];
          
          if (deletedFor.includes(currentUserId)) {
            return;
          }
        
          newMessages.push({
            id: d.id,
            text: data.text || "",
            senderId: data.senderId,
            createdAt: data.createdAt?.toMillis() || Date.now(),
            isRead: data.isRead || false,
            deletedFor: data.deletedFor || [],
            replyTo: data.replyTo,
            isForwarded: data.isForwarded,
            isEdited: data.isEdited,
            audio: data.audio,
            images: data.images,
            file: getChatFileFromFirestore(data.file),
            video: getChatVideoFromFirestore(data.video),
          });

          if (data.senderId !== currentUserId && !data.isRead) {
            unreadMessageIds.push(d.id);
          }
        });

        setMessages(newMessages);
        setIsLoading(false);

        if (unreadMessageIds.length > 0) {
          const batch = writeBatch(firestore);

          unreadMessageIds.forEach((id) => {
            const docRef = doc(firestore, "chats", chatId, "messages", id);
            batch.update(docRef, { isRead: true });
          });

          const chatRef = doc(firestore, "chats", chatId);
          batch.update(chatRef, {
            [`unreadCount.${currentUserId}`]: 0
          });

          batch.commit().catch(console.error);
        }
      },
      (error) => {
        console.error("Error fetching messages:", error);
        setIsLoading(false);
      }
    );

    // Separate listener for the chat document to get pinnedMessage and typing status
    const chatRef = doc(firestore, "chats", chatId);
    const unsubscribeChat = onSnapshot(chatRef, (chatDoc) => {
      const data = chatDoc.data();
      if (data) {
        let pins: PinnedMessage[] = [];
        if (Array.isArray(data.pinnedMessages)) {
          pins = data.pinnedMessages;
        } else if (data.pinnedMessage) {
          pins = [data.pinnedMessage];
        }
        setPinnedMessages(pins);
        
        if (contactId && data.typing?.[contactId]) {
          setIsFriendTyping(true);
        } else {
          setIsFriendTyping(false);
        }
      } else {
        setPinnedMessages([]);
        setIsFriendTyping(false);
      }
    });

    return () => {
      unsubscribe();
      unsubscribeChat();
    };
  }, [chatId, currentUserId, contactId]);

  const setTyping = async (isTyping: boolean) => {
    if (!chatId || !currentUserId) return;
    try {
      const chatRef = doc(firestore, "chats", chatId);
      await setDoc(
        chatRef,
        {
          typing: {
            [currentUserId]: isTyping
          }
        },
        { merge: true }
      );
    } catch (error) {
      console.error("Error updating typing status:", error);
    }
  };

  const _sendMessage = async (
    text: string, 
    replyTo?: ReplyToSnippet,
    audioInfo?: { uri: string; duration: number; waveform: number[] },
    imagesUris?: string[],
    fileInfo?: SelectedChatFile,
    videoInfo?: SelectedChatMedia,
  ) => {
    if (!chatId || !currentUserId || !contactId) return;
    if (!text.trim() && !audioInfo && (!imagesUris || imagesUris.length === 0) && !fileInfo && !videoInfo) return;

    const newMessageRef = doc(collection(firestore, "chats", chatId, "messages"));
    const isMedia = !!audioInfo || (imagesUris && imagesUris.length > 0) || !!fileInfo || !!videoInfo;
    
    if (isMedia) {
      const pendingMessage: Message = {
        id: newMessageRef.id,
        text: text.trim(),
        senderId: currentUserId,
        createdAt: Date.now(),
        isRead: true,
        status: "sending",
        ...(replyTo && { replyTo }),
        ...(imagesUris && imagesUris.length > 0 && { images: imagesUris }),
        ...(fileInfo && { file: buildChatFilePayload(fileInfo, fileInfo.uri) }),
        ...(videoInfo && { video: buildChatVideoPayload(videoInfo, videoInfo.uri) }),
        ...(audioInfo && {
          audio: {
            url: audioInfo.uri, // use local uri
            duration: audioInfo.duration,
            waveform: audioInfo.waveform,
          }
        }),
      };
      setPendingMessages(prev => [...prev, pendingMessage]);
    }

    try {
      const batch = writeBatch(firestore);
      
      let audioUrl;
      if (audioInfo) {
        audioUrl = await uploadVoiceMessage(audioInfo.uri, chatId, newMessageRef.id);
      }

      let imageUrls: string[] = [];
      if (imagesUris && imagesUris.length > 0) {
        imageUrls = await Promise.all(
          imagesUris.map((uri, index) => (
            isRemoteMediaUri(uri)
              ? uri
              : uploadImageMessage(uri, chatId, newMessageRef.id, index)
          ))
        );
      }

      let filePayload: ChatFile | undefined;
      if (fileInfo) {
        const uploadResult = await uploadFileMessage(
          fileInfo.uri,
          fileInfo.name,
          chatId,
          newMessageRef.id,
          fileInfo.mimeType,
        );
        filePayload = buildChatFilePayload(
          fileInfo,
          uploadResult.url,
          uploadResult.storagePath,
          uploadResult.extension,
        );
      }

      let videoUrl;
      let uploadVideoInfo = videoInfo;
      if (videoInfo) {
        if (isRemoteMediaUri(videoInfo.uri)) {
          videoUrl = videoInfo.uri;
        } else {
          const compressionResult = await compressVideoForUploadAsync({
            uri: videoInfo.uri,
            fileName: videoInfo.fileName,
            mimeType: videoInfo.mimeType,
          });

          uploadVideoInfo = buildCompressedVideoInfo(videoInfo, compressionResult);
          videoUrl = await uploadVideoMessage(
            uploadVideoInfo.uri,
            chatId,
            newMessageRef.id,
            uploadVideoInfo.fileName,
            uploadVideoInfo.mimeType ?? DEFAULT_VIDEO_MIME_TYPE,
          );
        }
      }

      const messageData = {
        text: text.trim(),
        senderId: currentUserId,
        createdAt: serverTimestamp(),
        isRead: false,
        ...(replyTo && { replyTo }),
        ...(audioInfo && audioUrl && {
          audio: {
            url: audioUrl,
            duration: audioInfo.duration,
            waveform: audioInfo.waveform,
          }
        }),
        ...(imageUrls.length > 0 && { images: imageUrls }),
        ...(filePayload && { file: filePayload }),
        ...(uploadVideoInfo && videoUrl && {
          video: buildChatVideoPayload(uploadVideoInfo, videoUrl),
        }),
      };

      batch.set(newMessageRef, messageData);

      const chatRef = doc(firestore, "chats", chatId);
      
      batch.set(
        chatRef,
        {
          participants: [currentUserId, contactId],
          lastMessage: {
            text: getMessagePreviewText({ text: text.trim(), audio: audioInfo, images: imageUrls, file: fileInfo, video: uploadVideoInfo }),
            senderId: currentUserId,
            createdAt: serverTimestamp(),
          },
          updatedAt: serverTimestamp(),
          unreadCount: {
            [contactId]: increment(1)
          },
        },
        { merge: true }
      );

      await batch.commit();
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    } finally {
      if (isMedia) {
        setPendingMessages(prev => prev.filter(m => m.id !== newMessageRef.id));
      }
    }
  };

  const sendMessage = async (
    text: string, 
    replyTo?: ReplyToSnippet,
    audioInfo?: { uri: string; duration: number; waveform: number[] },
    imagesUris?: string[],
    fileInfo?: SelectedChatFile,
    videoInfo?: SelectedChatMedia,
  ) => {
    if (!chatId || !currentUserId || !contactId) return;

    if (imagesUris && imagesUris.length > 0) {
      const promises = imagesUris.map((uri, index) => {
        const msgText = index === 0 ? text : "";
        return _sendMessage(msgText, replyTo, undefined, [uri]);
      });
      await Promise.all(promises);
      return;
    }

    return _sendMessage(text, replyTo, audioInfo, undefined, fileInfo, videoInfo);
  };

  const deleteMessage = async (messageId: string, type: "me" | "everyone") => {
    if (!chatId || !currentUserId) return;
    
    try {
      const docRef = doc(firestore, "chats", chatId, "messages", messageId);
      
      if (type === "everyone") {
        await deleteDoc(docRef);
      } else {
        await updateDoc(docRef, {
          deletedFor: arrayUnion(currentUserId)
        });
      }
    } catch (error) {
      console.error("Error deleting message:", error);
      throw error;
    }
  };

  const deleteMultipleMessages = async (messageIds: string[], type: "me" | "everyone") => {
    if (!chatId || !currentUserId || messageIds.length === 0) return;
    
    try {
      const batch = writeBatch(firestore);
      
      messageIds.forEach(messageId => {
        const docRef = doc(firestore, "chats", chatId, "messages", messageId);
        
        if (type === "everyone") {
          batch.delete(docRef);
        } else {
          batch.update(docRef, {
            deletedFor: arrayUnion(currentUserId)
          });
        }
      });
      
      await batch.commit();
    } catch (error) {
      console.error("Error deleting multiple messages:", error);
      throw error;
    }
  };

  const togglePinMessage = async (message: PinnedMessage) => {
    if (!chatId) return;
    const chatRef = doc(firestore, "chats", chatId);
    try {
      const chatDoc = await getDoc(chatRef);
      const data = chatDoc.data();
      
      let pins: PinnedMessage[] = [];
      if (data && Array.isArray(data.pinnedMessages)) {
        pins = data.pinnedMessages;
      } else if (data && data.pinnedMessage) {
        pins = [data.pinnedMessage];
      }
      
      const exists = pins.some(p => p.id === message.id);
      if (exists) {
        pins = pins.filter(p => p.id !== message.id);
      } else {
        pins.push(message);
      }
      
      if (data) {
        await updateDoc(chatRef, {
          pinnedMessages: pins,
          pinnedMessage: null // migrate old field
        });
      } else {
        await setDoc(chatRef, {
          pinnedMessages: pins,
          pinnedMessage: null
        });
      }
    } catch (error) {
      console.error("Error toggling pinned message:", error);
    }
  };

  const forwardMessages = async (targetContactId: string, messagesToForward: Message[]) => {
    if (!currentUserId || !targetContactId || messagesToForward.length === 0) return;
    
    const targetChatId = [currentUserId, targetContactId].sort().join("_");
    
    try {
      const batch = writeBatch(firestore);
      
      messagesToForward.forEach((msg, index) => {
        const newMessageRef = doc(collection(firestore, "chats", targetChatId, "messages"));
        
        const messageData: Record<string, unknown> = {
          text: msg.text || "",
          senderId: currentUserId,
          createdAt: Timestamp.fromMillis(Date.now() + index),
          isRead: false,
          isForwarded: true,
        };

        if (msg.images) {
          messageData.images = msg.images;
        }

        if (msg.audio) {
          messageData.audio = msg.audio;
        }

        if (msg.file) {
          messageData.file = msg.file;
        }

        if (msg.video) {
          messageData.video = msg.video;
        }

        batch.set(newMessageRef, messageData);
      });
      
      const chatRef = doc(firestore, "chats", targetChatId);
      batch.set(
        chatRef,
        {
          participants: [currentUserId, targetContactId],
          lastMessage: {
            text: getMessagePreviewText(messagesToForward[messagesToForward.length - 1]),
            senderId: currentUserId,
            createdAt: serverTimestamp(),
          },
          updatedAt: serverTimestamp(),
          unreadCount: {
            [targetContactId]: increment(messagesToForward.length)
          },
        },
        { merge: true }
      );
      
      await batch.commit();
    } catch (error) {
      console.error("Error forwarding messages:", error);
      throw error;
    }
  };

  const editMessage = async (messageId: string, newText: string) => {
    if (!chatId || !newText.trim()) return;
    
    try {
      const messageRef = doc(firestore, "chats", chatId, "messages", messageId);
      await updateDoc(messageRef, {
        text: newText.trim(),
        isEdited: true
      });
    } catch (error) {
      console.error("Error editing message:", error);
    }
  };

  const combinedMessages = useMemo(() => {
    const combined = [...messages];
    pendingMessages.forEach(pm => {
      if (!combined.some(m => m.id === pm.id)) {
        combined.push(pm);
      }
    });
    return combined.sort((a, b) => a.createdAt - b.createdAt);
  }, [messages, pendingMessages]);

  return { 
    messages: combinedMessages, 
    pinnedMessages,
    isFriendTyping,
    isLoading, 
    sendMessage, 
    deleteMessage, 
    deleteMultipleMessages,
    togglePinMessage,
    forwardMessages,
    editMessage,
    setTyping
  };
}
