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
import { firestore } from "../services/firebase";
import { uploadImageMessage, uploadVoiceMessage } from "../services/storage";

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
  status?: "sending" | "sent" | "error";
};

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
    imagesUris?: string[]
  ) => {
    if (!chatId || !currentUserId || !contactId) return;
    if (!text.trim() && !audioInfo && (!imagesUris || imagesUris.length === 0)) return;

    const newMessageRef = doc(collection(firestore, "chats", chatId, "messages"));
    const isMedia = !!audioInfo || (imagesUris && imagesUris.length > 0);
    
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
          imagesUris.map((uri, index) => uploadImageMessage(uri, chatId, newMessageRef.id, index))
        );
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
      };

      batch.set(newMessageRef, messageData);

      const chatRef = doc(firestore, "chats", chatId);
      
      batch.set(
        chatRef,
        {
          participants: [currentUserId, contactId],
          lastMessage: {
            text: audioInfo ? "🎤 Voice message" : (imageUrls.length > 0 ? "📷 Photo message" : text.trim()),
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
    imagesUris?: string[]
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

    return _sendMessage(text, replyTo, audioInfo, undefined);
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
        batch.set(newMessageRef, {
          text: msg.text,
          senderId: currentUserId,
          createdAt: Timestamp.fromMillis(Date.now() + index),
          isRead: false,
          isForwarded: true,
        });
      });
      
      const chatRef = doc(firestore, "chats", targetChatId);
      batch.set(
        chatRef,
        {
          participants: [currentUserId, targetContactId],
          lastMessage: {
            text: messagesToForward[messagesToForward.length - 1].text,
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
