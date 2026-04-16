// npx firebase emulators:start --only auth

import { getApp } from "@react-native-firebase/app";
import { connectAuthEmulator, getAuth } from "@react-native-firebase/auth";
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

    console.log(`[Firebase] Auth Emulator at ${localIp}:9099`);
  } catch (e) {
    console.log("[Firebase] Auth Emulator setup failed", e);
  }
}

export { app, auth };
