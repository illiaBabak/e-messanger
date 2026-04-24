import firestore from "@react-native-firebase/firestore";
import { useEffect, useState } from "react";

export type Message = {
  id: string;
  text: string;
  senderId: string;
  createdAt: number;
  isRead: boolean;
};

export function useMessages(currentUserId: string | undefined | null, contactId: string | undefined) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const chatId = currentUserId && contactId 
    ? [currentUserId, contactId].sort().join("_") 
    : null;

  useEffect(() => {
    if (!chatId || !currentUserId) {
      setMessages([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const messagesRef = firestore()
      .collection("chats")
      .doc(chatId)
      .collection("messages")
      .orderBy("createdAt", "asc");

    const unsubscribe = messagesRef.onSnapshot(
      (snapshot) => {
        if (!snapshot || snapshot.empty) {
          setMessages([]);
          setIsLoading(false);
          return;
        }

        const newMessages: Message[] = [];
        const unreadMessageIds: string[] = [];

        snapshot.docs.forEach((doc) => {
          const data = doc.data();
        
          newMessages.push({
            id: doc.id,
            text: data.text || "",
            senderId: data.senderId,
            createdAt: data.createdAt?.toMillis() || Date.now(),
            isRead: data.isRead || false,
          });

          if (data.senderId !== currentUserId && !data.isRead) {
            unreadMessageIds.push(doc.id);
          }
        });

        setMessages(newMessages);
        setIsLoading(false);

        if (unreadMessageIds.length > 0) {
          const batch = firestore().batch();

          unreadMessageIds.forEach((id) => {
            const docRef = firestore().collection("chats").doc(chatId).collection("messages").doc(id);
            
            batch.update(docRef, { isRead: true });
          });

          batch.commit().catch(console.error);
        }
      },
      (error) => {
        console.error("Error fetching messages:", error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [chatId, currentUserId]);

  const sendMessage = async (text: string) => {
    if (!chatId || !currentUserId || !contactId || !text.trim()) return;

    const messageData = {
      text: text.trim(),
      senderId: currentUserId,
      createdAt: firestore.FieldValue.serverTimestamp(),
      isRead: false,
    };

    try {
      const batch = firestore().batch();

      const newMessageRef = firestore().collection("chats").doc(chatId).collection("messages").doc();
      batch.set(newMessageRef, messageData);

      const chatRef = firestore().collection("chats").doc(chatId);
      
      batch.set(
        chatRef,
        {
          participants: [currentUserId, contactId],
          lastMessage: {
            text: text.trim(),
            senderId: currentUserId,
            createdAt: firestore.FieldValue.serverTimestamp(),
          },
          updatedAt: firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      await batch.commit();
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  return { messages, isLoading, sendMessage };
}
