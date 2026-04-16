import { onAuthStateChanged } from "@/services/auth";
import { FirebaseAuthTypes } from "@react-native-firebase/auth";
import { createContext, useContext, useEffect, useState } from "react";

interface AuthContextType {
  user: FirebaseAuthTypes.User | null;
  isLoading: boolean;
  isProfileComplete: boolean;
  refreshContext: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const refreshContext = () => setTick(t => t + 1);

  // Re-evaluates whenever `user` changes OR `tick` is updated (forcing re-render)
  const isProfileComplete = !!(user && user.displayName);

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
