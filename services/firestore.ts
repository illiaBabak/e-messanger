import { 
  doc, 
  getDoc, 
  runTransaction, 
  serverTimestamp, 
  setDoc, 
  updateDoc 
} from '@react-native-firebase/firestore';
import { firestore } from './firebase';

export class FirestoreError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.code = code;
    this.name = 'FirestoreError';
  }
}

export async function isLoginAvailable(login: string): Promise<boolean> {
  try {
    const usernameDoc = await getDoc(doc(firestore, 'usernames', login));

    return !usernameDoc.exists();
  } catch (error) {
    console.error('[Firestore] isLoginAvailable error', error);
    throw new FirestoreError('Failed to check username availability', 'firestore/check-failed');
  }
}

export async function saveUserProfileData(
  userId: string,
  login: string,
  name: string,
  photoURL: string | null
): Promise<void> {
  const userRef = doc(firestore, 'users', userId);
  const usernameRef = doc(firestore, 'usernames', login);

  try {
    await runTransaction(firestore, async (transaction) => {
      const usernameDoc = await transaction.get(usernameRef);
      
      if (usernameDoc.exists() && usernameDoc.data()?.userId !== userId) {
        throw new FirestoreError('Username is already taken', 'firestore/username-taken');
      }
      
      transaction.set(usernameRef, { userId });
      
      transaction.set(userRef, {
        userId,
        login,
        name,
        photoURL,
        createdAt: serverTimestamp(),
      }, { merge: true });
    });
  } catch (error) {
    console.error('[Firestore] saveUserProfileData error', error);
    if (error instanceof FirestoreError) throw error;
    throw new FirestoreError('Failed to save profile', 'firestore/transaction-failed');
  }
}

export async function updateUserPresence(uid: string, status: 'online' | 'offline'): Promise<void> {
  try {
    const userRef = doc(firestore, 'users', uid);
    await updateDoc(userRef, {
      status,
      lastSeenMs: serverTimestamp(),
    });
  } catch (error) {
    console.error('[Firestore] updateUserPresence error', error);
  }
}

export async function addContactToFirestore(uid: string, contactId: string, alias?: string): Promise<void> {
  try {
    const contactRef = doc(firestore, 'users', uid, 'contacts', contactId);
    
    const data: { addedAt: ReturnType<typeof serverTimestamp>; alias?: string } = {
      addedAt: serverTimestamp(),
    };
    
    if (alias) {
      data.alias = alias;
    }

    await setDoc(contactRef, data, { merge: true });
  } catch (error) {
    console.error('[Firestore] addContactToFirestore error', error);
    throw new FirestoreError('Failed to add contact', 'firestore/write-failed');
  }
}

