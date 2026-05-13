import { collection, doc, onSnapshot } from "@react-native-firebase/firestore";
import { useEffect, useState } from "react";
import { firestore } from "../services/firebase";

export type ContactProfile = {
  id: string;
  name: string;
  status: string;
  lastSeenMs: number;
  photoURL?: string | null;
  addedAt: number;
};

export function useContacts(uid: string | undefined | null) {
  const [contacts, setContacts] = useState<ContactProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setContacts([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    let profileUnsubscribers: (() => void)[] = [];

    const contactsRef = collection(firestore, "users", uid, "contacts");
    
    const unsubContacts = onSnapshot(
      contactsRef,
      (contactsSnapshot) => {
        // Clear previous profile listeners if the root contacts change
        profileUnsubscribers.forEach((unsub) => unsub());
        profileUnsubscribers = [];

        if (contactsSnapshot.empty) {
          setContacts([]);
          setIsLoading(false);
          return;
        }

        const contactIds = contactsSnapshot.docs.map((d) => ({
          id: d.id,
          addedAt: d.data().addedAt?.toMillis() || Date.now(),
          alias: d.data().alias || null,
        }));

        const contactMap = new Map<string, ContactProfile>();
        
        let initialLoadCount = 0;

        contactIds.forEach(({ id, addedAt, alias }) => {
          const userRef = doc(firestore, "users", id);
          
          const unsubProfile = onSnapshot(userRef, (userDoc) => {
            const data = userDoc.data();
            
            if (data) {
              contactMap.set(id, {
                id,
                name: alias || data.name || "Unknown",
                status: data.status || "offline",
                lastSeenMs: data.lastSeenMs?.toMillis() || Date.now(),
                photoURL: data.avatarUrl || data.photoURL,
                addedAt,
              });

              // Trigger a re-render with the latest mapped values
              setContacts(Array.from(contactMap.values()));
            }

            initialLoadCount++;
            if (initialLoadCount >= contactIds.length) {
              setIsLoading(false);
            }
          });
          profileUnsubscribers.push(unsubProfile);
        });
      },
      (error) => {
        console.error("Error fetching contacts subcollection", error);
        setIsLoading(false);
      }
    );

    return () => {
      unsubContacts();
      profileUnsubscribers.forEach((unsub) => unsub());
    };
  }, [uid]);

  return { contacts, isLoading };
}
