import { getCurrentUser, onAuthStateChanged } from "@/services/auth";
import { FirebaseAuthTypes } from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import { createContext, useContext, useEffect, useState } from "react";

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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(async (currentUser) => {
      setIsLoading(true);
      setUser(currentUser);

      if (currentUser) {
        try {
          const userDoc = await firestore().collection("users").doc(currentUser.uid).get();

          setIsProfileComplete(userDoc.exists());
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

  const refreshContext = async () => {
    const updatedUser = getCurrentUser();

    setUser(updatedUser);

    if (updatedUser) {
      try {
        const userDoc = await firestore().collection("users").doc(updatedUser.uid).get();

        setIsProfileComplete(userDoc.exists());
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
