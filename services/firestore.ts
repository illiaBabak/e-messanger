import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

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
    const usernameDoc = await firestore().collection('usernames').doc(login).get();

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
  const db = firestore();
  
  const userRef = db.collection('users').doc(userId);
  const usernameRef = db.collection('usernames').doc(login);

  try {
    await db.runTransaction(async (transaction) => {
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
        createdAt: firestore.FieldValue.serverTimestamp(),
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
    await firestore().collection('users').doc(uid).update({
      status,
      lastSeenMs: firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error('[Firestore] updateUserPresence error', error);
  }
}

export async function addContactToFirestore(uid: string, contactId: string, alias?: string): Promise<void> {
  try {
    const data: { addedAt: FirebaseFirestoreTypes.FieldValue; alias?: string } = {
      addedAt: firestore.FieldValue.serverTimestamp(),
    };
    
    if (alias) {
      data.alias = alias;
    }

    await firestore()
      .collection('users')
      .doc(uid)
      .collection('contacts')
      .doc(contactId)
      .set(data, { merge: true });
  } catch (error) {
    console.error('[Firestore] addContactToFirestore error', error);
    throw new FirestoreError('Failed to add contact', 'firestore/write-failed');
  }
}
