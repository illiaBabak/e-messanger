import {
  FirebaseAuthTypes,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPhoneNumber,
  updateProfile
} from "@react-native-firebase/auth";
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import Constants from "expo-constants";

import { saveUserProfileData, updateUserPresence } from "./firestore";

import { auth } from "./firebase";

export class AuthError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.code = code;
    this.name = "AuthError";
  }
}

const webClientId = Constants.expoConfig?.extra?.webClientId;
const iosClientId = Constants.expoConfig?.extra?.iosClientId;

GoogleSignin.configure({
  webClientId: webClientId,
  iosClientId: iosClientId,
});

export async function signInWithGoogle(): Promise<FirebaseAuthTypes.UserCredential> {
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    const { data } = await GoogleSignin.signIn();
    
    const idToken = data?.idToken;

    if (!idToken) {
      throw new AuthError("No ID token found", "google-auth-failed");
    }

    const googleCredential = GoogleAuthProvider.credential(idToken);
    
    return signInWithCredential(auth, googleCredential)
  } catch (error) {
    throw handleAuthError(error, "[Auth] signInWithGoogle error");
  }
}

let _confirmationResult: FirebaseAuthTypes.ConfirmationResult | null = null;

export async function sendOtp(phoneNumber: string): Promise<boolean> {
  try {
    _confirmationResult = await signInWithPhoneNumber(auth, phoneNumber);
    return true;
  } catch (error) {
    throw handleAuthError(error, "[Auth] sendOtp error");
  }
}

export async function verifyOtp(otp: string): Promise<FirebaseAuthTypes.User> {
  if (!_confirmationResult) {
    throw new AuthError("No confirmation result. Call sendOtp first.", "missing-confirmation");
  }

  try {
    const credential = await _confirmationResult.confirm(otp);
    _confirmationResult = null;

    if (!credential?.user) {
      throw new AuthError("Authentication failed", "auth-failed");
    }

    return credential.user;
  } catch (error) {
    throw handleAuthError(error, "[Auth] verifyOtp error");
  }
}

export async function updateUserProfile(
  login: string,
  name: string,
  photoURL: string | null 
): Promise<void> {
  const user = auth.currentUser;

  if (!user) throw new AuthError("No authenticated user", "unauthenticated");

  try {
    const defaultPhotoURL = photoURL || undefined;

    await updateProfile(user, { displayName: name, photoURL: defaultPhotoURL });

    await saveUserProfileData(user.uid, login, name, photoURL);
  } catch (error) {
    if (error instanceof Error && error.name === "FirestoreError") {
      throw error
    }
    throw handleAuthError(error, "[Auth] updateProfile error");
  }
}

export function getCurrentUser(): FirebaseAuthTypes.User | null {
  return auth.currentUser;
}


export async function signOut(): Promise<void> {
  try {
    const user = auth.currentUser;
    if (user) {
      await updateUserPresence(user.uid, 'offline');
    }
    await firebaseSignOut(auth);
  } catch (error) {
    throw handleAuthError(error, "[Auth] signOut error");
  }
}

export function onAuthStateChanged(
  callback: (user: FirebaseAuthTypes.User | null) => void
): () => void {
  return firebaseOnAuthStateChanged(auth, callback);
}

function handleAuthError(error: unknown, logPrefix: string): AuthError {
  const err = error as { code?: string; message?: string };
  
  console.error(`${logPrefix}:`, err.code, err.message);
  
  const code = err.code ?? "unknown";
  
  return new AuthError(getReadableErrorMessage(code), code);
}

function getReadableErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    "auth/invalid-phone-number": "Invalid phone number format",
    "auth/too-many-requests": "Too many attempts. Try again later",
    "auth/invalid-verification-code": "Invalid verification code",
    "auth/code-expired": "Code expired. Request a new one",
    "auth/network-request-failed": "Network error. Check your connection",
    "auth/quota-exceeded": "SMS quota exceeded. Try again later",
  };

  return messages[code] ?? "Something went wrong. Try again";
}
