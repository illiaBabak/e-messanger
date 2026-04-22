import { getCurrentUser, onAuthStateChanged } from "@/services/auth";
import { updateUserPresence } from "@/services/firestore";
import { FirebaseAuthTypes } from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus } from "react-native";

interface AuthContextType {
  user: FirebaseAuthTypes.User | null;
  isLoading: boolean;
  isProfileComplete: boolean;
  refreshContext: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProfileComplete, setIsProfileComplete] = useState(false);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(async (currentUser) => {
      setIsLoading(true);
      setUser(currentUser);

      if (currentUser) {
        try {
          const userDoc = await firestore().collection("users").doc(currentUser.uid).get();
          setIsProfileComplete(userDoc.exists());
          
          if (userDoc.exists()) {
            await updateUserPresence(currentUser.uid, 'online');
          }
        } catch (error) {
          console.error("Failed to fetch user profile completion status", error);
          setIsProfileComplete(false);
        }
      } else {
        setIsProfileComplete(false);
      }

      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState: AppStateStatus) => {
      if (!user) return;
      
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === "active"
      ) {
        updateUserPresence(user.uid, 'online');
      } else if (nextAppState.match(/inactive|background/)) {
        updateUserPresence(user.uid, 'offline');
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [user]);

  const refreshContext = async () => {
    const updatedUser = getCurrentUser();

    setUser(updatedUser);

    if (updatedUser) {
      try {
        const userDoc = await firestore().collection("users").doc(updatedUser.uid).get();

        setIsProfileComplete(userDoc.exists());
        
        if (userDoc.exists()) {
          await updateUserPresence(updatedUser.uid, 'online');
        }
      } catch (error) {
        setIsProfileComplete(false);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isProfileComplete,
        refreshContext,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}

