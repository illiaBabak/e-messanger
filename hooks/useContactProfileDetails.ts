import { doc, onSnapshot } from "@react-native-firebase/firestore";
import { useEffect, useState } from "react";

import { firestore } from "@/services/firebase";

const DEFAULT_CONTACT_NAME = "Unknown";
const DEFAULT_CONTACT_STATUS = "offline";

export type ContactProfileDetails = {
  id: string;
  name: string;
  status: string;
  login?: string;
  phoneNumber?: string;
  photoURL?: string;
  avatarUrl?: string;
  profileImageUrl?: string;
  profilePhotoUrl?: string;
  profilePhotoLargeUrl?: string;
  lastSeenMs?: number;
};

type ContactProfileDetailsState = {
  profile: ContactProfileDetails | null;
  isLoading: boolean;
  errorMessage: string | null;
};

type TimestampLike = {
  toMillis: () => number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function hasToMillis(value: unknown): value is TimestampLike {
  return isRecord(value) && typeof value.toMillis === "function";
}

function getOptionalTimestampMs(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (!hasToMillis(value)) {
    return undefined;
  }

  const millis = value.toMillis();

  return Number.isFinite(millis) ? millis : undefined;
}

function getContactProfileDetails(
  id: string,
  value: unknown,
): ContactProfileDetails | null {
  if (!isRecord(value)) {
    return null;
  }

  const name = getOptionalString(value.name) ?? DEFAULT_CONTACT_NAME;
  const status = getOptionalString(value.status) ?? DEFAULT_CONTACT_STATUS;
  const login = getOptionalString(value.login);
  const phoneNumber = getOptionalString(value.phoneNumber);
  const photoURL = getOptionalString(value.photoURL);
  const avatarUrl = getOptionalString(value.avatarUrl);
  const profileImageUrl = getOptionalString(value.profileImageUrl);
  const profilePhotoUrl = getOptionalString(value.profilePhotoUrl);
  const profilePhotoLargeUrl = getOptionalString(value.profilePhotoLargeUrl);
  const lastSeenMs = getOptionalTimestampMs(value.lastSeenMs);

  return {
    id,
    name,
    status,
    ...(login !== undefined && { login }),
    ...(phoneNumber !== undefined && { phoneNumber }),
    ...(photoURL !== undefined && { photoURL }),
    ...(avatarUrl !== undefined && { avatarUrl }),
    ...(profileImageUrl !== undefined && { profileImageUrl }),
    ...(profilePhotoUrl !== undefined && { profilePhotoUrl }),
    ...(profilePhotoLargeUrl !== undefined && { profilePhotoLargeUrl }),
    ...(lastSeenMs !== undefined && { lastSeenMs }),
  };
}

export function useContactProfileDetails(
  contactId: string | undefined,
): ContactProfileDetailsState {
  const [profile, setProfile] = useState<ContactProfileDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!contactId) {
      setProfile(null);
      setIsLoading(false);
      setErrorMessage(null);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const contactRef = doc(firestore, "users", contactId);

    const unsubscribe = onSnapshot(
      contactRef,
      (snapshot) => {
        const data: unknown = snapshot.data();

        setProfile(getContactProfileDetails(contactId, data));
        setIsLoading(false);
      },
      (error) => {
        console.error("Error fetching contact profile details", error);
        setErrorMessage("Could not load contact details.");
        setIsLoading(false);
      },
    );

    return () => unsubscribe();
  }, [contactId]);

  return { profile, isLoading, errorMessage };
}
