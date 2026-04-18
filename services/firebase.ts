// npx firebase emulators:start --only auth

import { getApp } from "@react-native-firebase/app";
import { connectAuthEmulator, getAuth } from "@react-native-firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "@react-native-firebase/firestore";
import { connectStorageEmulator, getStorage } from "@react-native-firebase/storage";
import Constants from "expo-constants";
import { NativeModules } from "react-native";

const app = getApp();
const auth = getAuth(app);

if (__DEV__) {
  try {
    const scriptURL = NativeModules.SourceCode?.scriptURL;
    const hostUri = Constants.expoConfig?.hostUri;

    const localIp =
      scriptURL?.match(/\/\/([^/:]+)/)?.[1] ??
      hostUri?.split(":")[0] ??
      null;

    if (!localIp) {
      throw new Error("Could not determine Mac local IP for Firebase emulator");
    }

    connectAuthEmulator(auth, `http://${localIp}:9099`, {
      disableWarnings: true,
    });
    
    const firestore = getFirestore(app);
    connectFirestoreEmulator(firestore, localIp, 8080);
    
    const storage = getStorage(app);
    connectStorageEmulator(storage, localIp, 9199);

    console.log(`[Firebase] Emulators connected at ${localIp}`);
  } catch (e) {
    console.log("[Firebase] Emulator setup failed", e);
  }
}

export { app, auth };
