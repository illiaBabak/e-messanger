import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as MediaLibrary from "expo-media-library";
import { useLocalSearchParams, useRouter } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChatInput } from "@/components/chat/ChatInput";
import { FileMessage } from "@/components/chat/FileMessage";
import { ImageMessage } from "@/components/chat/ImageMessage";
import { ImagePreviewModal } from "@/components/chat/ImagePreviewModal";
import { VideoMessage } from "@/components/chat/VideoMessage";
import { VideoPreviewModal } from "@/components/chat/VideoPreviewModal";
import { VoiceMessagePlayer } from "@/components/chat/VoiceMessagePlayer";
import { Colors, FontSizes, Spacing } from "@/constants/theme";
import { useChatsList } from "@/hooks/useChatsList";
import { useContacts } from "@/hooks/useContacts";
import { getMessagePreviewText, Message, useMessages } from "@/hooks/useMessages";
import { useAuth } from "@/providers/AuthProvider";
import type { ChatVideo, SelectedChatMedia } from "@/types/chatMedia";
import { saveDownloadedMediaRecord, type DownloadedMediaRecord } from "@/utils/downloadedMediaStorage";
import { downloadVideoToLibraryAsync } from "@/utils/downloadVideoToLibrary";

const VIDEO_PREVIEW_URI_PATTERN = /^(https?:\/\/|file:\/\/)/i;

function isValidVideoPreviewUri(uri: string): boolean {
  return VIDEO_PREVIEW_URI_PATTERN.test(uri.trim());
}

function getDownloadErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Could not download video.";
}

async function saveDownloadedMediaRecordSafely(
  record: DownloadedMediaRecord,
): Promise<void> {
  try {
    await saveDownloadedMediaRecord(record);
  } catch (error) {
    console.warn("Failed to save downloaded media record", error);
  }
}

type MessageItemProps = {
  item: Message;
  currentUserId: string | undefined;
  contactName: string;
  isSelectionMode: boolean;
  isSelected: boolean;
  isHighlighted: boolean;
  onPress: (id: string) => void;
  onImagePress: (url: string, contactName: string, timeStr: string, message: Message) => void;
  onVideoPress: (video: ChatVideo, contactName: string, timeStr: string, message: Message) => void;
  onLongPress: (item: Message, layout: { x: number; y: number; width: number; height: number }) => void;
  onScrollToReply: (id: string) => void;
};

const MessageItem = memo(({ item, currentUserId, contactName, isSelectionMode, isSelected, isHighlighted, onPress, onImagePress, onVideoPress, onLongPress, onScrollToReply }: MessageItemProps) => {
  const viewRef = useRef<View>(null);
  const isMe = item.senderId === currentUserId;
  const highlightOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isHighlighted) {
      highlightOpacity.setValue(0);
      Animated.sequence([
        Animated.timing(highlightOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(highlightOpacity, {
          toValue: 0,
          duration: 400,
          delay: 400,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isHighlighted, highlightOpacity]);

  const handlePress = () => {
    if (isSelectionMode) {
      onPress(item.id);
    }
  };

  const handleImagePress = () => {
    if (isSelectionMode) {
      onPress(item.id);
    } else if (item.images && item.images.length > 0) {
      onImagePress(item.images[0], contactName, new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), item);
    }
  };

  const handleVideoPress = () => {
    if (isSelectionMode) {
      onPress(item.id);
    } else if (item.video) {
      onVideoPress(item.video, contactName, new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), item);
    }
  };

  const handleLongPress = () => {
    if (isSelectionMode) return;
    viewRef.current?.measure((x, y, width, height, pageX, pageY) => {
      onLongPress(item, { x: pageX, y: pageY, width, height });
    });
  };

  const hasImages = Array.isArray(item.images) && item.images.length > 0;
  const isOnlyImage = hasImages && !item.text && !item.audio && !item.replyTo && !item.isForwarded && !item.file && !item.video;
  const isOnlyVideo = item.video && !item.text && !item.audio && !hasImages && !item.replyTo && !item.isForwarded && !item.file;
  const isOnlyFile = item.file && !item.text && !item.audio && !hasImages && !item.replyTo && !item.isForwarded && !item.video;

  if (isOnlyImage) {
    return (
      <View style={styles.messageWrapper}>
        {isSelectionMode && (
          <Pressable onPress={handlePress} style={styles.selectionCheckbox}>
            <Ionicons
              name={isSelected ? "checkmark-circle" : "ellipse-outline"}
              size={24}
              color={isSelected ? Colors.primary : Colors.textMuted}
            />
          </Pressable>
        )}
        <View style={[styles.messageRow, isMe ? styles.messageRowMe : styles.messageRowFriend]}>
           <ImageMessage
              url={item.images?.[0] ?? ""}
              isMe={isMe}
              timeStr={new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              status={item.status}
              isRead={item.isRead}
              onPress={handleImagePress}
              onLongPress={(layout) => onLongPress(item, layout)}
           />
        </View>
      </View>
    );
  }

  if (isOnlyVideo && item.video) {
    return (
      <View style={styles.messageWrapper}>
        {isSelectionMode && (
          <Pressable onPress={handlePress} style={styles.selectionCheckbox}>
            <Ionicons
              name={isSelected ? "checkmark-circle" : "ellipse-outline"}
              size={24}
              color={isSelected ? Colors.primary : Colors.textMuted}
            />
          </Pressable>
        )}
        <View style={[styles.messageRow, isMe ? styles.messageRowMe : styles.messageRowFriend]}>
          <VideoMessage
            uri={item.video.url}
            fileName={item.video.fileName}
            duration={item.video.duration}
            isMe={isMe}
            timeStr={new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            status={item.status}
            isRead={item.isRead}
            onPress={handleVideoPress}
            onLongPress={(layout) => onLongPress(item, layout)}
          />
        </View>
      </View>
    );
  }

  if (isOnlyFile && item.file) {
    return (
      <View style={styles.messageWrapper}>
        {isSelectionMode && (
          <Pressable onPress={handlePress} style={styles.selectionCheckbox}>
            <Ionicons
              name={isSelected ? "checkmark-circle" : "ellipse-outline"}
              size={24}
              color={isSelected ? Colors.primary : Colors.textMuted}
            />
          </Pressable>
        )}
        <View style={[styles.messageRow, isMe ? styles.messageRowMe : styles.messageRowFriend]}>
           <FileMessage
              name={item.file.name}
              url={item.file.url}
              mimeType={item.file.mimeType}
              size={item.file.size}
              isMe={isMe}
              timeStr={new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              status={item.status}
              isRead={item.isRead}
              onLongPress={handleLongPress}
           />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.messageWrapper}>
      {isSelectionMode && (
        <Pressable onPress={handlePress} style={styles.selectionCheckbox}>
          <Ionicons
            name={isSelected ? "checkmark-circle" : "ellipse-outline"}
            size={24}
            color={isSelected ? Colors.primary : Colors.textMuted}
          />
        </Pressable>
      )}
      <View style={[styles.messageRow, isMe ? styles.messageRowMe : styles.messageRowFriend]}>
        <Pressable
          ref={viewRef}
          onPress={handlePress}
          onLongPress={handleLongPress}
          delayLongPress={250}
          style={[styles.messageBubble, isMe ? styles.messageBubbleMe : styles.messageBubbleFriend]}
        >
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                 backgroundColor: "rgba(0,0,0,0.15)",
                 opacity: highlightOpacity,
                 borderRadius: 20,
                 borderBottomLeftRadius: isMe ? 20 : 4,
                 borderBottomRightRadius: isMe ? 4 : 20,
                 zIndex: 10,
              }
            ]}
          />
          {item.isForwarded && (
            <Text style={[styles.forwardedText, isMe ? styles.forwardedTextMe : styles.forwardedTextFriend]}>
              Forwarded message
            </Text>
          )}
          {item.replyTo && (
            <Pressable
              style={[styles.bubbleReplyContainer, isMe ? styles.bubbleReplyContainerMe : styles.bubbleReplyContainerFriend]}
              onPress={() => onScrollToReply(item.replyTo!.id)}
            >
              <View style={[styles.bubbleReplyLine, isMe ? styles.bubbleReplyLineMe : styles.bubbleReplyLineFriend]} />
              <View style={styles.bubbleReplyContent}>
                <Text style={[styles.bubbleReplyName, isMe ? styles.bubbleReplyNameMe : styles.bubbleReplyNameFriend]}>
                  {item.replyTo.senderId === currentUserId ? "You" : contactName}
                </Text>
                <Text style={[styles.bubbleReplyText, isMe ? styles.bubbleReplyTextMe : styles.bubbleReplyTextFriend]} numberOfLines={1}>
                  {getMessagePreviewText(item.replyTo)}
                </Text>
              </View>
            </Pressable>
          )}
          {hasImages && item.images && (
            <View style={styles.imageGrid}>
              {item.images.map((url, idx) => (
                <Pressable key={idx} style={styles.messageImageWrapper} onPress={handleImagePress}>
                  <Image
                    source={url}
                    style={styles.messageImage}
                    contentFit="cover"
                    transition={null}
                  />
                  {item.status === "sending" && (
                    <View style={styles.imageSendingOverlay}>
                      <ActivityIndicator size="small" color={Colors.white} />
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          )}
          {item.video ? (
            <VideoMessage
              uri={item.video.url}
              fileName={item.video.fileName}
              duration={item.video.duration}
              isMe={isMe}
              timeStr={new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              status={item.status}
              isRead={item.isRead}
              onPress={handleVideoPress}
              onLongPress={(layout) => onLongPress(item, layout)}
            />
          ) : null}
          {item.file ? (
            <FileMessage
              name={item.file.name}
              url={item.file.url}
              mimeType={item.file.mimeType}
              size={item.file.size}
              isMe={isMe}
              timeStr={new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              status={item.status}
              isRead={item.isRead}
            />
          ) : null}
          {item.audio ? (
            <VoiceMessagePlayer
              messageId={item.id}
              url={item.audio.url}
              duration={item.audio.duration}
              waveform={item.audio.waveform}
              isOwnMessage={isMe}
            />
          ) : item.text ? (
            <Text style={[styles.messageText, isMe ? styles.messageTextMe : styles.messageTextFriend, { marginTop: hasImages || item.file || item.video ? 8 : 0 }]}>
              {item.text}
            </Text>
          ) : null}
          <View style={styles.messageFooter}>
            {item.isEdited && (
              <Text style={[styles.messageEdited, isMe ? styles.messageEditedMe : styles.messageEditedFriend]}>
                Edited
              </Text>
            )}
            <Text style={[styles.messageTime, isMe ? styles.messageTimeMe : styles.messageTimeFriend]}>
              {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </Text>
            {isMe && (
              <Ionicons
                name={item.isRead ? "checkmark-done" : "checkmark"}
                size={14}
                color={item.isRead ? "#4CAF50" : "#8E8E93"}
                style={styles.messageCheckmarks}
              />
            )}
          </View>
        </Pressable>
      </View>
    </View>
  );
});

MessageItem.displayName = "MessageItem";

export default function ChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { contacts } = useContacts(user?.uid);
  const { chats } = useChatsList(user?.uid);
  const { messages, pinnedMessages, isFriendTyping, sendMessage, deleteMessage, deleteMultipleMessages, togglePinMessage, forwardMessages, editMessage, setTyping } = useMessages(user?.uid, id as string);

  const contactInfo = useMemo(() => contacts.find((c) => c.id === id), [contacts, id]);
  const chatInfo = useMemo(() => chats.find((c) => c.friendId === id), [chats, id]);

  const name = contactInfo?.name || chatInfo?.name || "Unknown";
  const status = contactInfo?.status || chatInfo?.status || "offline";
  const decodedPhotoURL = contactInfo?.photoURL || chatInfo?.photoURL;

  const [messageText, setMessageText] = useState("");
  const typingTimeoutRef = useRef<number | null>(null);

  const handleTextChange = (text: string) => {
    setMessageText(text);
    if (text.length > 0) {
      setTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        setTyping(false);
      }, 2000);
    } else {
      setTyping(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  const flatListRef = useRef<FlatList>(null);
  
  const [activePinnedIndex, setActivePinnedIndex] = useState(0);
  const activePinnedMessage = pinnedMessages.length > 0 ? pinnedMessages[activePinnedIndex % pinnedMessages.length] : null;
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  const scrollToMessageId = (messageId: string) => {
    const indexInMessages = messages.findIndex(m => m.id === messageId);
    if (indexInMessages !== -1) {
      flatListRef.current?.scrollToIndex({ index: indexInMessages, animated: true, viewPosition: 0.5 });
      setHighlightedMessageId(null);
      setTimeout(() => setHighlightedMessageId(messageId), 50);
    }
  };

  const handlePinBarPress = () => {
    if (pinnedMessages.length === 0) return;
    
    const nextIndex = (activePinnedIndex + 1) % pinnedMessages.length;
    setActivePinnedIndex(nextIndex);
    
    const targetMessage = pinnedMessages[nextIndex];
    if (targetMessage) {
      scrollToMessageId(targetMessage.id);
    }
  };

  const textInputRef = useRef<TextInput>(null);

  // Context Menu State
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [messageLayout, setMessageLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // Multi-Selection State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());

  // Phase 3 State
  const [replyingToMessage, setReplyingToMessage] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [forwardModalVisible, setForwardModalVisible] = useState(false);

  const forwardTargets = useMemo(() => {
    const map = new Map();
    contacts.forEach(c => map.set(c.id, { id: c.id, name: c.name, photoURL: c.photoURL }));
    chats.forEach(c => {
      if (!map.has(c.friendId)) {
        map.set(c.friendId, { id: c.friendId, name: c.name, photoURL: c.photoURL });
      }
    });
    return Array.from(map.values());
  }, [contacts, chats]);

  // Image Preview State
  const [previewImage, setPreviewImage] = useState<{ url: string, name: string, time: string, message: Message } | null>(null);
  const [previewVideo, setPreviewVideo] = useState<{ video: ChatVideo, name: string, time: string, message: Message } | null>(null);
  const [galleryRefreshKey, setGalleryRefreshKey] = useState(0);

  const handleDownloadImage = async (url: string) => {
    try {
      let fileUri = url;
      if (url.startsWith('http')) {
        const downloadFile = new FileSystem.File(FileSystem.Paths.cache, `downloaded_img_${Date.now()}.jpg`);
        const file = await FileSystem.File.downloadFileAsync(url, downloadFile);
        fileUri = file.uri;
      }
      const asset = await MediaLibrary.createAssetAsync(fileUri);
      await saveDownloadedMediaRecordSafely({
        assetId: asset.id,
        savedAt: Date.now(),
        type: "photo",
        fileName: asset.filename,
      });
      setGalleryRefreshKey(previousKey => previousKey + 1);
      showToast("Image saved to gallery");
      closeMenu();
    } catch {
      Alert.alert("Error", "Could not download image");
      closeMenu();
    }
  };

  const handleDownloadVideo = async (video: ChatVideo) => {
    try {
      const result = await downloadVideoToLibraryAsync({
        uri: video.url,
        fileName: video.fileName,
        mimeType: video.mimeType,
      });
      await saveDownloadedMediaRecordSafely({
        assetId: result.assetId,
        savedAt: Date.now(),
        type: "video",
        fileName: video.fileName,
        mimeType: video.mimeType,
      });
      setGalleryRefreshKey(previousKey => previousKey + 1);
      showToast("Video saved to gallery");
      closeMenu();
    } catch (error) {
      console.error("Failed to download video", error);
      Alert.alert("Video Download Failed", getDownloadErrorMessage(error));
      closeMenu();
    }
  };

  // Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  const showToast = (message: string) => {
    setToastMessage(message);
    Animated.sequence([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(2000),
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => setToastMessage(null));
  };

  const handleBack = () => {
    router.back();
  };

  const handleSend = async () => {
    const textToSend = messageText.trim();
    if (textToSend) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      setTyping(false);

      if (editingMessage) {
        setMessageText("");
        setEditingMessage(null);
        try {
          await editMessage(editingMessage.id, textToSend);
        } catch (error) {
          console.error("Failed to edit message:", error);
          setMessageText(textToSend); // restore on error
        }
        return;
      }

      setMessageText("");
      const replySnippet = replyingToMessage 
        ? { id: replyingToMessage.id, text: getMessagePreviewText(replyingToMessage), senderId: replyingToMessage.senderId }
        : undefined;
      
      setReplyingToMessage(null);
      
      try {
        await sendMessage(textToSend, replySnippet);
      } catch (error) {
        console.error("Failed to send message:", error);
        setMessageText(textToSend);
      }
    }
  };

  const formatTime = (ms: number) => {
    const date = new Date(ms);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const menuAnimY = useRef(new Animated.Value(0)).current;

  const handleLongPressMessage = (item: Message, layout: { x: number; y: number; width: number; height: number }) => {
    const { height: screenHeight } = Dimensions.get("window");
    const menuHeight = 350; // approximate menu height
    const spaceNeeded = layout.height + menuHeight + 20;

    let adjustedY = layout.y;
    // Push message up if it goes off bottom of screen
    if (layout.y + spaceNeeded > screenHeight) {
      adjustedY = screenHeight - spaceNeeded;
      if (adjustedY < 100) adjustedY = 100; // prevent going too high
    }

    setSelectedMessage(item);
    setMessageLayout({ ...layout, y: layout.y }); // Keep original Y in layout
    setMenuVisible(true);

    menuAnimY.setValue(layout.y);
    Animated.spring(menuAnimY, {
      toValue: adjustedY,
      useNativeDriver: false,
      bounciness: 4,
      speed: 12,
    }).start();
  };

  const closeMenu = () => {
    setMenuVisible(false);
    setSelectedMessage(null);
    setMessageLayout(null);
  };

  const handleCopy = async () => {
    if (selectedMessage) {
      await Clipboard.setStringAsync(selectedMessage.text);
      closeMenu();
      showToast("Message copied");
    }
  };

  const handleDelete = (msgToDel?: Message) => {
    const msg = msgToDel || selectedMessage;
    if (!msg) return;
    const isMe = msg.senderId === user?.uid;

    Alert.alert(
      "Delete Message",
      "Are you sure you want to delete this message?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete for me",
          style: "destructive",
          onPress: () => {
            deleteMessage(msg.id, "me");
            closeMenu();
          },
        },
        ...(isMe
          ? [
              {
                text: "Delete for everyone",
                style: "destructive" as const,
                onPress: () => {
                  deleteMessage(msg.id, "everyone");
                  closeMenu();
                },
              },
            ]
          : []),
      ]
    );
  };

  const toggleSelection = (messageId: string) => {
    setSelectedMessageIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
        if (newSet.size === 0) {
          setIsSelectionMode(false);
        }
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  const handleSelectContextAction = () => {
    if (selectedMessage) {
      setIsSelectionMode(true);
      setSelectedMessageIds(new Set([selectedMessage.id]));
      closeMenu();
    }
  };

  const handleReplyAction = (msgToReply?: Message) => {
    const msg = msgToReply || selectedMessage;
    if (msg) {
      setReplyingToMessage(msg);
      closeMenu();
      setTimeout(() => textInputRef.current?.focus(), 100);
    }
  };

  const handleEditAction = () => {
    if (selectedMessage && selectedMessage.senderId === user?.uid) {
      setEditingMessage(selectedMessage);
      setMessageText(selectedMessage.text);
      closeMenu();
      setTimeout(() => textInputRef.current?.focus(), 100);
    }
  };

  const handlePinAction = () => {
    if (selectedMessage) {
      togglePinMessage({
        id: selectedMessage.id,
        text: getMessagePreviewText(selectedMessage),
        senderId: selectedMessage.senderId,
      });
      closeMenu();
    }
  };

  const handleForwardContextAction = (msgToForward?: Message) => {
    const msg = msgToForward || selectedMessage;
    if (msg) {
      setSelectedMessageIds(new Set([msg.id]));
      setForwardModalVisible(true);
      closeMenu();
    }
  };

  const handleForwardSelectionAction = () => {
    setForwardModalVisible(true);
  };

  const executeForward = async (contactId: string) => {
    const msgs = messages.filter(m => selectedMessageIds.has(m.id));
    if (msgs.length > 0) {
      try {
        await forwardMessages(contactId, msgs);
      } catch {
        Alert.alert("Error", "Could not forward messages.");
      }
    }
    setForwardModalVisible(false);
    exitSelectionMode();
  };

  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedMessageIds(new Set());
  };

  const handleDeleteMultiple = () => {
    if (selectedMessageIds.size === 0) return;

    const selectedMessagesList = messages.filter((m) => selectedMessageIds.has(m.id));
    const allMine = selectedMessagesList.every((m) => m.senderId === user?.uid);

    Alert.alert(
      "Delete Messages",
      `Are you sure you want to delete ${selectedMessageIds.size} message(s)?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete for me",
          style: "destructive",
          onPress: async () => {
            await deleteMultipleMessages(Array.from(selectedMessageIds), "me");
            exitSelectionMode();
          },
        },
        ...(allMine
          ? [
              {
                text: "Delete for everyone",
                style: "destructive" as const,
                onPress: async () => {
                  await deleteMultipleMessages(Array.from(selectedMessageIds), "everyone");
                  exitSelectionMode();
                },
              },
            ]
          : []),
      ]
    );
  };


  const handleMessagePress = useCallback((id: string) => {
    toggleSelection(id);
  }, [toggleSelection]);

  const handleMessageLongPress = useCallback((item: Message, layout: { x: number; y: number; width: number; height: number }) => {
    handleLongPressMessage(item, layout);
  }, [handleLongPressMessage]);

  const handleImagePress = useCallback((url: string, contactName: string, timeStr: string, message: Message) => {
    setPreviewImage({ url, name: contactName, time: timeStr, message });
  }, []);

  const handleVideoPress = useCallback((video: ChatVideo, contactName: string, timeStr: string, message: Message) => {
    if (!isValidVideoPreviewUri(video.url)) {
      Alert.alert("Video Error", "This video has an invalid playback URL.");
      return;
    }

    setPreviewVideo({ video, name: contactName, time: timeStr, message });
  }, []);

  const handleSendVideo = useCallback(
    async (video: SelectedChatMedia) => {
      try {
        await sendMessage("", undefined, undefined, undefined, undefined, video);
      } catch (error) {
        console.error("Failed to send video:", error);
        Alert.alert("Error", "Could not send video.");
        throw error;
      }
    },
    [sendMessage],
  );

  const handleScrollToReply = useCallback((id: string) => {
    scrollToMessageId(id);
  }, [scrollToMessageId]);

  const renderItem = useCallback(({ item }: { item: Message }) => (
    <MessageItem
      item={item}
      currentUserId={user?.uid}
      contactName={name}
      isSelectionMode={isSelectionMode}
      isSelected={selectedMessageIds.has(item.id)}
      isHighlighted={highlightedMessageId === item.id}
      onPress={handleMessagePress}
      onImagePress={handleImagePress}
      onVideoPress={handleVideoPress}
      onLongPress={handleMessageLongPress}
      onScrollToReply={handleScrollToReply}
    />
  ), [user?.uid, name, isSelectionMode, selectedMessageIds, highlightedMessageId, handleMessagePress, handleImagePress, handleVideoPress, handleMessageLongPress, handleScrollToReply]);

  const previewVideoMedia = useMemo<SelectedChatMedia | null>(() => {
    if (!previewVideo) {
      return null;
    }

    return {
      uri: previewVideo.video.url,
      type: "video",
      fileName: previewVideo.video.fileName,
      mimeType: previewVideo.video.mimeType,
      duration: previewVideo.video.duration,
      width: previewVideo.video.width,
      height: previewVideo.video.height,
      fileSize: previewVideo.video.size,
    };
  }, [previewVideo]);

  return (
    <LinearGradient
      colors={["#7CB9E8", "#B594E6", "#F294C8"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.backgroundImage}
    >
      <ImageBackground
        source={require("@/assets/images/chat-bg.png")}
        style={styles.backgroundImage}
        imageStyle={styles.backgroundImageStyle}
      >
        <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <FlatList
          ref={flatListRef}
          keyboardDismissMode="on-drag"
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onScrollToIndexFailed={(info) => {
            const wait = new Promise(resolve => setTimeout(resolve, 100));
            wait.then(() => {
              flatListRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.5 });
            });
          }}
          style={styles.messagesContainer}
          contentContainerStyle={{
            paddingTop: insets.top + (pinnedMessages.length > 0 ? 140 : 80), // Increased gap for pinned msg
            paddingBottom: Spacing.xl,
            paddingHorizontal: Spacing.md,
          }}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={10}
          removeClippedSubviews={Platform.OS === 'android'}
        />

        {isSelectionMode ? (
          <View style={[styles.headerContainer, styles.selectionHeader, { paddingTop: insets.top + Spacing.sm }]}>
            <Pressable style={styles.headerIconButton} onPress={handleDeleteMultiple}>
              <Ionicons name="trash-outline" size={24} color="#FF3B30" />
            </Pressable>

            <Text style={styles.selectionCountText}>
              {selectedMessageIds.size} Selected
            </Text>

            <Pressable style={styles.headerIconButton} onPress={exitSelectionMode}>
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </Pressable>
          </View>
        ) : (
          <View style={[styles.headerContainer, { paddingTop: insets.top + Spacing.sm }]}>
            <Pressable style={styles.floatingCircle} onPress={handleBack}>
              <Ionicons name="chevron-back" size={24} color={Colors.primary} style={{ marginLeft: -2 }} />
            </Pressable>

            <View style={styles.floatingPill}>
              <Text style={styles.headerName}>{name}</Text>
              {isFriendTyping ? (
                <Text style={[styles.headerStatus, styles.headerStatusTyping]}>
                  typing...
                </Text>
              ) : (
                <Text
                  style={[
                    styles.headerStatus,
                    status === "online" && styles.headerStatusOnline,
                  ]}
                >
                  {status === "online" ? "Online" : "Last seen recently"}
                </Text>
              )}
            </View>

            <Pressable style={styles.floatingAvatar}>
              {decodedPhotoURL ? (
                <Image
                  source={decodedPhotoURL}
                  style={styles.avatarImage}
                  contentFit="cover"
                  transition={300}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>
                    {name?.charAt(0) || "?"}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        )}

        {activePinnedMessage && !isSelectionMode && (
          <Pressable 
            style={[styles.pinnedMessageContainer, { top: insets.top + 65 }]}
            onPress={handlePinBarPress}
          >
            <View style={styles.pinnedMessageLine} />
            <View style={styles.pinnedMessageContent}>
              <Text style={styles.pinnedMessageTitle}>
                Pinned Message {pinnedMessages.length > 1 ? `(${activePinnedIndex % pinnedMessages.length + 1}/${pinnedMessages.length})` : ''}
              </Text>
              <Text style={styles.pinnedMessageText} numberOfLines={1}>
                {getMessagePreviewText(activePinnedMessage)}
              </Text>
            </View>
            <Pressable onPress={() => togglePinMessage(activePinnedMessage)} style={styles.pinnedMessageClose}>
              <Ionicons name="close" size={20} color={Colors.textSecondary} />
            </Pressable>
          </Pressable>
        )}

        {isSelectionMode ? (
          <View
            style={[
              styles.footerContainer,
              styles.selectionFooter,
              { paddingBottom: Math.max(insets.bottom, Spacing.sm) },
            ]}
          >
            <Pressable style={styles.forwardButton} onPress={handleForwardSelectionAction}>
              <Ionicons name="arrow-redo-outline" size={24} color={Colors.primary} />
              <Text style={styles.forwardButtonText}>Forward</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ paddingBottom: Math.max(insets.bottom, Spacing.sm) }}>
            <ChatInput
              messageText={messageText}
              setMessageText={handleTextChange}
              onSendText={handleSend}
              onSendAudio={(audioInfo) => {
                sendMessage("", undefined, audioInfo).catch(console.error);
              }}
              onSendMedia={(uris) => {
                sendMessage("", undefined, undefined, uris).catch(console.error);
              }}
              onSendVideo={handleSendVideo}
              onSendFile={(fileInfo) => {
                sendMessage("", undefined, undefined, undefined, fileInfo).catch(console.error);
              }}
              galleryRefreshKey={galleryRefreshKey}
              replyingToMessage={replyingToMessage}
              editingMessage={editingMessage}
              onCancelReplyOrEdit={() => {
                setReplyingToMessage(null);
                setEditingMessage(null);
                if (editingMessage) setMessageText("");
              }}
              name={name}
              currentUserId={user?.uid}
              textInputRef={textInputRef}
            />
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Toast */}
      {toastMessage && (
        <Animated.View style={[styles.toastContainer, { opacity: toastOpacity, bottom: insets.bottom + 100 }]} pointerEvents="none">
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      )}

      </ImageBackground>

      {/* Context Menu Modal */}
      <Modal transparent visible={menuVisible} animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={closeMenu}>
          <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
          {selectedMessage && messageLayout && (
            <Animated.View
              style={{
                position: "absolute",
                top: menuAnimY,
                left: messageLayout.x,
                width: messageLayout.width,
                height: messageLayout.height,
              }}
            >
              {selectedMessage.images && selectedMessage.images.length > 0 && !selectedMessage.text && !selectedMessage.audio && !selectedMessage.replyTo && !selectedMessage.isForwarded && !selectedMessage.file && !selectedMessage.video ? (
                <View pointerEvents="none">
                  <ImageMessage
                    url={selectedMessage.images[0]}
                    isMe={selectedMessage.senderId === user?.uid}
                    timeStr={formatTime(selectedMessage.createdAt)}
                    status={selectedMessage.status}
                    isRead={selectedMessage.isRead}
                    onPress={() => {}}
                    onLongPress={() => {}}
                  />
                </View>
              ) : selectedMessage.video && !selectedMessage.text && !selectedMessage.audio && !selectedMessage.images && !selectedMessage.replyTo && !selectedMessage.isForwarded && !selectedMessage.file ? (
                <View pointerEvents="none">
                  <VideoMessage
                    uri={selectedMessage.video.url}
                    fileName={selectedMessage.video.fileName}
                    duration={selectedMessage.video.duration}
                    isMe={selectedMessage.senderId === user?.uid}
                    timeStr={formatTime(selectedMessage.createdAt)}
                    status={selectedMessage.status}
                    isRead={selectedMessage.isRead}
                    onPress={() => {}}
                    onLongPress={() => {}}
                  />
                </View>
              ) : selectedMessage.file && !selectedMessage.text && !selectedMessage.audio && !selectedMessage.images && !selectedMessage.replyTo && !selectedMessage.isForwarded && !selectedMessage.video ? (
                <View pointerEvents="none">
                  <FileMessage
                    name={selectedMessage.file.name}
                    url={selectedMessage.file.url}
                    mimeType={selectedMessage.file.mimeType}
                    size={selectedMessage.file.size}
                    isMe={selectedMessage.senderId === user?.uid}
                    timeStr={formatTime(selectedMessage.createdAt)}
                    status={selectedMessage.status}
                    isRead={selectedMessage.isRead}
                    onLongPress={() => {}}
                  />
                </View>
              ) : (
                <View
                  style={[
                    styles.messageBubble,
                    selectedMessage.senderId === user?.uid
                      ? styles.messageBubbleMe
                      : styles.messageBubbleFriend,
                    { maxWidth: "100%", width: "100%" } // Ensure it exactly matches the measured width
                  ]}
                >
                  {selectedMessage.isForwarded && (
                    <Text style={[styles.forwardedText, selectedMessage.senderId === user?.uid ? styles.forwardedTextMe : styles.forwardedTextFriend]}>
                      Forwarded message
                    </Text>
                  )}
                  {selectedMessage.replyTo && (
                    <View style={[styles.bubbleReplyContainer, selectedMessage.senderId === user?.uid ? styles.bubbleReplyContainerMe : styles.bubbleReplyContainerFriend]}>
                      <View style={[styles.bubbleReplyLine, selectedMessage.senderId === user?.uid ? styles.bubbleReplyLineMe : styles.bubbleReplyLineFriend]} />
                      <View style={styles.bubbleReplyContent}>
                        <Text style={[styles.bubbleReplyName, selectedMessage.senderId === user?.uid ? styles.bubbleReplyNameMe : styles.bubbleReplyNameFriend]}>
                          {selectedMessage.replyTo.senderId === user?.uid ? "You" : name}
                        </Text>
                        <Text style={[styles.bubbleReplyText, selectedMessage.senderId === user?.uid ? styles.bubbleReplyTextMe : styles.bubbleReplyTextFriend]} numberOfLines={1}>
                          {getMessagePreviewText(selectedMessage.replyTo)}
                        </Text>
                      </View>
                    </View>
                  )}
                  {selectedMessage.audio ? (
                    <VoiceMessagePlayer
                      messageId={selectedMessage.id}
                      url={selectedMessage.audio.url}
                      duration={selectedMessage.audio.duration}
                      waveform={selectedMessage.audio.waveform}
                      isOwnMessage={selectedMessage.senderId === user?.uid}
                    />
                  ) : selectedMessage.video ? (
                    <VideoMessage
                      uri={selectedMessage.video.url}
                      fileName={selectedMessage.video.fileName}
                      duration={selectedMessage.video.duration}
                      isMe={selectedMessage.senderId === user?.uid}
                      timeStr={formatTime(selectedMessage.createdAt)}
                      status={selectedMessage.status}
                      isRead={selectedMessage.isRead}
                      onPress={() => {}}
                      onLongPress={() => {}}
                    />
                  ) : selectedMessage.file ? (
                    <FileMessage
                      name={selectedMessage.file.name}
                      url={selectedMessage.file.url}
                      mimeType={selectedMessage.file.mimeType}
                      size={selectedMessage.file.size}
                      isMe={selectedMessage.senderId === user?.uid}
                      timeStr={formatTime(selectedMessage.createdAt)}
                      status={selectedMessage.status}
                      isRead={selectedMessage.isRead}
                    />
                  ) : (
                    <Text
                      style={[
                        styles.messageText,
                        selectedMessage.senderId === user?.uid
                          ? styles.messageTextMe
                          : styles.messageTextFriend,
                      ]}
                    >
                      {getMessagePreviewText(selectedMessage)}
                    </Text>
                  )}
                  <View style={styles.messageFooter}>
                    {selectedMessage.isEdited && (
                      <Text style={[styles.messageEdited, selectedMessage.senderId === user?.uid ? styles.messageEditedMe : styles.messageEditedFriend]}>
                        Edited
                      </Text>
                    )}
                    <Text
                      style={[
                        styles.messageTime,
                        selectedMessage.senderId === user?.uid
                          ? styles.messageTimeMe
                          : styles.messageTimeFriend,
                      ]}
                    >
                      {formatTime(selectedMessage.createdAt)}
                    </Text>
                    {selectedMessage.senderId === user?.uid && (
                      <Ionicons
                        name={selectedMessage.isRead ? "checkmark-done" : "checkmark"}
                        size={14}
                        color={selectedMessage.isRead ? "#4CAF50" : "#8E8E93"}
                        style={styles.messageCheckmarks}
                      />
                    )}
                  </View>
                </View>
              )}

              <View
                style={[
                  styles.contextMenu,
                  selectedMessage.senderId === user?.uid ? { right: 0 } : { left: 0 },
                ]}
              >
                {selectedMessage.images && selectedMessage.images.length > 0 ? (
                  <>
                    <Pressable style={styles.menuItem} onPress={() => handleReplyAction()}>
                      <Ionicons name="arrow-undo-outline" size={20} color={Colors.textPrimary} />
                      <Text style={styles.menuItemText}>Reply</Text>
                    </Pressable>
                    <Pressable style={styles.menuItem} onPress={() => handleDownloadImage(selectedMessage.images?.[0] ?? "")}>
                      <Ionicons name="download-outline" size={20} color={Colors.textPrimary} />
                      <Text style={styles.menuItemText}>Download</Text>
                    </Pressable>
                    <Pressable style={styles.menuItem} onPress={handlePinAction}>
                      <Ionicons name={pinnedMessages.some(p => p.id === selectedMessage.id) ? "pin" : "pin-outline"} size={20} color={Colors.textPrimary} />
                      <Text style={styles.menuItemText}>
                        {pinnedMessages.some(p => p.id === selectedMessage.id) ? "Unpin" : "Pin"}
                      </Text>
                    </Pressable>
                    <Pressable style={styles.menuItem} onPress={() => handleForwardContextAction()}>
                      <Ionicons name="arrow-redo-outline" size={20} color={Colors.textPrimary} />
                      <Text style={styles.menuItemText}>Forward</Text>
                    </Pressable>
                    <Pressable style={styles.menuItem} onPress={() => handleDelete()}>
                      <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                      <Text style={[styles.menuItemText, { color: "#FF3B30" }]}>Delete</Text>
                    </Pressable>
                    <Pressable style={styles.menuItem} onPress={handleSelectContextAction}>
                      <Ionicons name="checkmark-circle-outline" size={20} color={Colors.textPrimary} />
                      <Text style={styles.menuItemText}>Select</Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Pressable style={styles.menuItem} onPress={() => handleReplyAction()}>
                      <Ionicons name="arrow-undo-outline" size={20} color={Colors.textPrimary} />
                      <Text style={styles.menuItemText}>Reply</Text>
                    </Pressable>
                    {selectedMessage.video ? (
                      <Pressable
                        style={styles.menuItem}
                        onPress={() => {
                          if (selectedMessage.video) {
                            void handleDownloadVideo(selectedMessage.video);
                          }
                        }}
                      >
                        <Ionicons name="download-outline" size={20} color={Colors.textPrimary} />
                        <Text style={styles.menuItemText}>Download</Text>
                      </Pressable>
                    ) : null}
                    {!selectedMessage.audio && !selectedMessage.video && !selectedMessage.file && selectedMessage.text && selectedMessage.senderId === user?.uid && (
                      <Pressable style={styles.menuItem} onPress={handleEditAction}>
                        <Ionicons name="pencil-outline" size={20} color={Colors.textPrimary} />
                        <Text style={styles.menuItemText}>Edit</Text>
                      </Pressable>
                    )}
                    {!selectedMessage.audio && !selectedMessage.video && !selectedMessage.file && selectedMessage.text && (
                      <Pressable style={styles.menuItem} onPress={handleCopy}>
                        <Ionicons name="copy-outline" size={20} color={Colors.textPrimary} />
                        <Text style={styles.menuItemText}>Copy</Text>
                      </Pressable>
                    )}
                    <Pressable style={styles.menuItem} onPress={handlePinAction}>
                      <Ionicons name={pinnedMessages.some(p => p.id === selectedMessage.id) ? "pin" : "pin-outline"} size={20} color={Colors.textPrimary} />
                      <Text style={styles.menuItemText}>
                        {pinnedMessages.some(p => p.id === selectedMessage.id) ? "Unpin" : "Pin"}
                      </Text>
                    </Pressable>
                    <Pressable style={styles.menuItem} onPress={() => handleForwardContextAction()}>
                      <Ionicons name="arrow-redo-outline" size={20} color={Colors.textPrimary} />
                      <Text style={styles.menuItemText}>Forward</Text>
                    </Pressable>
                    <Pressable style={styles.menuItem} onPress={handleSelectContextAction}>
                      <Ionicons name="checkmark-circle-outline" size={20} color={Colors.textPrimary} />
                      <Text style={styles.menuItemText}>Select</Text>
                    </Pressable>
                    <View style={styles.menuDivider} />
                    <Pressable style={styles.menuItem} onPress={() => handleDelete()}>
                      <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                      <Text style={[styles.menuItemText, { color: "#FF3B30" }]}>Delete</Text>
                    </Pressable>
                  </>
                )}
              </View>
            </Animated.View>
          )}
        </Pressable>
      </Modal>

      {/* Forward Modal */}
      <Modal visible={forwardModalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.forwardModalContainer}>
          <View style={styles.forwardModalHeader}>
            <Text style={styles.forwardModalTitle}>Forward to...</Text>
            <Pressable onPress={() => setForwardModalVisible(false)} style={styles.forwardModalCancelBtn}>
              <Text style={styles.forwardModalCancelText}>Cancel</Text>
            </Pressable>
          </View>
          <FlatList
            data={forwardTargets}
            keyExtractor={c => c.id}
            contentContainerStyle={styles.forwardListContent}
            renderItem={({ item }) => (
              <Pressable style={styles.forwardContactRow} onPress={() => executeForward(item.id)}>
                {item.photoURL ? (
                  <Image source={item.photoURL} style={styles.forwardContactAvatar} />
                ) : (
                  <View style={styles.forwardContactAvatarPlaceholder}>
                    <Text style={styles.forwardContactInitial}>{item.name.charAt(0)}</Text>
                  </View>
                )}
                <Text style={styles.forwardContactName}>{item.name}</Text>
              </Pressable>
            )}
          />
        </View>
      </Modal>

      {/* Full Screen Image Preview Modal */}
      <ImagePreviewModal
        visible={!!previewImage}
        imageUrl={previewImage?.url || null}
        contactName={previewImage?.name || ""}
        timeStr={previewImage?.time || ""}
        onClose={() => setPreviewImage(null)}
        onReply={() => {
          if (previewImage) {
            handleReplyAction(previewImage.message);
            setPreviewImage(null);
          }
        }}
        onDownload={() => {
          if (previewImage) {
            handleDownloadImage(previewImage.url);
          }
        }}
        onDelete={() => {
          if (previewImage) {
            handleDelete(previewImage.message);
            setPreviewImage(null);
          }
        }}
        onForward={() => {
          if (previewImage) {
            handleForwardContextAction(previewImage.message);
            setPreviewImage(null);
          }
        }}
      />

      <VideoPreviewModal
        visible={!!previewVideo}
        video={previewVideoMedia}
        title={previewVideo?.name || ""}
        timeStr={previewVideo?.time}
        showTrimControls={false}
        autoPlay
        showActionsMenu
        showSendButton={false}
        actions={{
          onDownload: () => {
            if (previewVideo) {
              void handleDownloadVideo(previewVideo.video);
            }
          },
          onReply: () => {
            if (previewVideo) {
              handleReplyAction(previewVideo.message);
              setPreviewVideo(null);
            }
          },
          onForward: () => {
            if (previewVideo) {
              handleForwardContextAction(previewVideo.message);
              setPreviewVideo(null);
            }
          },
          onDelete: () => {
            if (previewVideo) {
              handleDelete(previewVideo.message);
              setPreviewVideo(null);
            }
          },
        }}
        onClose={() => setPreviewVideo(null)}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
  },
  backgroundImageStyle: {
    opacity: 0.2, // Blend the pattern with the vibrant gradient
  },
  container: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messageWrapper: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: Spacing.sm,
    width: "100%",
  },
  selectionCheckbox: {
    marginRight: Spacing.sm,
    paddingBottom: 8,
  },
  messageRow: {
    flex: 1,
    flexDirection: "row",
  },
  messageRowMe: {
    justifyContent: "flex-end",
  },
  messageRowFriend: {
    justifyContent: "flex-start",
  },
  messageBubble: {
    maxWidth: "80%",
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  messageBubbleMe: {
    backgroundColor: "#E1D5FA", // Light purple hex code as requested
    borderBottomRightRadius: 4,
  },
  messageBubbleFriend: {
    backgroundColor: Colors.white,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: FontSizes.md,
    lineHeight: 20,
  },
  messageTextMe: {
    color: Colors.textPrimary,
  },
  messageTextFriend: {
    color: Colors.textPrimary,
  },
  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 4,
    alignSelf: "flex-end",
  },
  messageTime: {
    fontSize: FontSizes.xs - 1,
  },
  messageTimeMe: {
    color: "#6D54A3", // Darker purple for time text
  },
  messageTimeFriend: {
    color: Colors.textMuted,
  },
  messageEdited: {
    fontSize: FontSizes.xs - 2,
    fontStyle: "italic",
    marginRight: 4,
  },
  messageEditedMe: {
    color: "#6D54A3",
  },
  messageEditedFriend: {
    color: Colors.textMuted,
  },
  messageCheckmarks: {
    marginLeft: 4,
  },
  headerContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.sm,
    zIndex: 10,
  },
  floatingCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.9)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  floatingPill: {
    flex: 1,
    marginHorizontal: Spacing.sm,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 22,
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerName: {
    fontSize: FontSizes.md,
    fontWeight: "bold",
    color: Colors.textPrimary,
  },
  headerStatus: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  headerStatusOnline: {
    color: Colors.primary,
  },
  headerStatusTyping: {
    color: Colors.primary,
    fontStyle: "italic",
    fontWeight: "500",
  },
  floatingAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.9)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    padding: 2,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 20,
  },
  avatarPlaceholder: {
    width: "100%",
    height: "100%",
    borderRadius: 20,
    backgroundColor: "#EBF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: FontSizes.md,
    fontWeight: "bold",
    color: Colors.primary,
  },
  footerContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  floatingInputWrapper: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 22,
    marginHorizontal: Spacing.xs,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: "hidden",
  },
  textInput: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingTop: Platform.OS === "ios" ? 12 : 10,
    paddingBottom: Platform.OS === "ios" ? 12 : 10,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    maxHeight: 120,
    minHeight: 44,
  },
  stickerButton: {
    padding: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  floatingCirclePrimary: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  modalOverlay: {
    flex: 1,
  },
  contextMenu: {
    position: "absolute",
    top: "100%",
    marginTop: 8,
    width: 200,
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuItemText: {
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    marginLeft: 12,
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },
  selectionHeader: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    justifyContent: "space-between",
  },
  headerIconButton: {
    padding: 8,
    width: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  selectionCountText: {
    fontSize: FontSizes.md,
    fontWeight: "bold",
    color: Colors.textPrimary,
  },
  selectionFooter: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    justifyContent: "center",
    paddingTop: Spacing.sm,
  },
  forwardButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  forwardButtonText: {
    fontSize: FontSizes.md,
    color: Colors.primary,
    marginLeft: 8,
    fontWeight: "600",
  },
  // Phase 3 Styles
  forwardedText: {
    fontSize: FontSizes.sm,
    fontStyle: "italic",
    marginBottom: 4,
  },
  forwardedTextMe: {
    color: "#6D54A3",
  },
  forwardedTextFriend: {
    color: Colors.textMuted,
  },
  bubbleReplyContainer: {
    flexDirection: "row",
    marginBottom: 6,
    paddingLeft: 8,
    borderLeftWidth: 2,
    minWidth: 150,
  },
  bubbleReplyContainerMe: {
    borderLeftColor: "#6D54A3",
  },
  bubbleReplyContainerFriend: {
    borderLeftColor: Colors.primary,
  },
  bubbleReplyLine: {
    display: "none", // Using borderLeft instead for simplicity
  },
  bubbleReplyLineMe: {},
  bubbleReplyLineFriend: {},
  bubbleReplyContent: {
    flex: 1,
  },
  bubbleReplyName: {
    fontSize: FontSizes.sm,
    fontWeight: "bold",
    marginBottom: 2,
  },
  bubbleReplyNameMe: {
    color: "#6D54A3",
  },
  bubbleReplyNameFriend: {
    color: Colors.primary,
  },
  bubbleReplyText: {
    fontSize: FontSizes.sm,
  },
  bubbleReplyTextMe: {
    color: Colors.textPrimary,
  },
  bubbleReplyTextFriend: {
    color: Colors.textSecondary,
  },
  pinnedMessageContainer: {
    position: "absolute",
    left: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 8,
    padding: Spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 9,
  },
  pinnedMessageLine: {
    width: 3,
    backgroundColor: Colors.primary,
    height: "100%",
    borderRadius: 2,
    marginRight: Spacing.sm,
  },
  pinnedMessageContent: {
    flex: 1,
  },
  pinnedMessageTitle: {
    fontSize: FontSizes.sm,
    fontWeight: "bold",
    color: Colors.primary,
    marginBottom: 2,
  },
  pinnedMessageText: {
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
  },
  pinnedMessageClose: {
    padding: 4,
  },
  inputAreaWrapper: {
    flex: 1,
    marginHorizontal: Spacing.xs,
  },
  replyPreviewContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 12,
    padding: Spacing.sm,
    marginBottom: 8,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  replyPreviewLine: {
    width: 3,
    backgroundColor: Colors.primary,
    height: "100%",
    borderRadius: 2,
    marginRight: Spacing.sm,
  },
  replyPreviewContent: {
    flex: 1,
  },
  replyPreviewName: {
    fontSize: FontSizes.sm,
    fontWeight: "bold",
    color: Colors.primary,
    marginBottom: 2,
  },
  replyPreviewText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  replyPreviewClose: {
    padding: 4,
  },
  forwardModalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  forwardModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  forwardModalTitle: {
    fontSize: FontSizes.lg,
    fontWeight: "bold",
    color: Colors.textPrimary,
  },
  forwardModalCancelBtn: {
    padding: 4,
  },
  forwardModalCancelText: {
    fontSize: FontSizes.md,
    color: Colors.primary,
  },
  forwardListContent: {
    paddingVertical: Spacing.sm,
  },
  forwardContactRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  forwardContactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  forwardContactAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EBF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  forwardContactInitial: {
    fontSize: FontSizes.md,
    fontWeight: "bold",
    color: Colors.primary,
  },
  forwardContactName: {
    fontSize: FontSizes.md,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginLeft: 12,
  },
  toastContainer: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 20,
    zIndex: 100,
  },
  toastText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: "500",
  },
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    borderRadius: 12,
    overflow: "hidden",
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
  },
  messageImageWrapper: {
    position: "relative",
  },
  imageSendingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
});
