import { collection, doc, onSnapshot, query, where } from "@react-native-firebase/firestore";
import { useEffect, useState } from "react";
import { firestore } from "../services/firebase";

export type ChatListItem = {
  id: string;
  friendId: string;
  name: string;
  status: string;
  photoURL?: string | null;
  lastMessageText: string;
  lastMessageSenderId: string;
  updatedAt: number;
};

export function useChatsList(uid: string | undefined | null) {
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setChats([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    let profileUnsubscribers: (() => void)[] = [];

    const chatsRef = collection(firestore, "chats");
    const q = query(chatsRef, where("participants", "array-contains", uid));

    const unsubChats = onSnapshot(
      q,
      (snapshot) => {
        profileUnsubscribers.forEach((unsub) => unsub());
        profileUnsubscribers = [];

        if (!snapshot || snapshot.empty) {
          setChats([]);
          setIsLoading(false);
          return;
        }

        const chatsData = snapshot.docs.map((d) => {
          const data = d.data();

          const friendId = data.participants.find((id: string) => id !== uid) || "";

          return {
            id: d.id,
            friendId,
            lastMessageText: data.lastMessage?.text || "",
            lastMessageSenderId: data.lastMessage?.senderId || "",
            updatedAt: data.updatedAt?.toMillis() || Date.now(),
          };
        });

        const chatMap = new Map<string, ChatListItem>();
        let initialLoadCount = 0;

        chatsData.forEach((chatMeta) => {
           if (!chatMeta.friendId) {
             initialLoadCount++;
             return;
           }

           const friendRef = doc(firestore, "users", chatMeta.friendId);
           const unsubProfile = onSnapshot(friendRef, (friendDoc) => {
             const data = friendDoc.data();

             if (data) {
                chatMap.set(chatMeta.id, {
                   ...chatMeta,
                   name: data.name || "Unknown",
                   status: data.status || "offline",
                   photoURL: data.photoURL,
                });
                
                const newChats = Array.from(chatMap.values()).sort((a, b) => b.updatedAt - a.updatedAt);
                setChats(newChats);
             }

             initialLoadCount++;
             
             if (initialLoadCount >= chatsData.length) {
                setIsLoading(false);
             }
           });
           profileUnsubscribers.push(unsubProfile);
        });
      },
      (error) => {
        console.error("Error fetching chats list", error);
        setIsLoading(false);
      }
    );

    return () => {
      unsubChats();
      profileUnsubscribers.forEach((unsub) => unsub());
    };
  }, [uid]);

  return { chats, isLoading };
}
