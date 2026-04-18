import { useAuth } from "@/providers/AuthProvider";
import { AuthError, getCurrentUser, updateUserProfile } from "@/services/auth";
import { FirestoreError, isLoginAvailable } from "@/services/firestore";
import { uploadProfilePicture } from "@/services/storage";
import { useRouter } from "expo-router";
import { useState } from "react";

export function useCreateProfile() {
  const router = useRouter();
  const { refreshContext } = useAuth();

  const [name, setName] = useState("");
  const [login, setLogin] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleNameChange = (text: string) => {
    setName(text);
    if (error) setError("");
  };

  const handleLoginChange = (text: string) => {
    const formattedText = text.toLowerCase().replace(/\s/g, "");
    
    setLogin(formattedText);

    if (error) setError("");
  };

  const handlePhotoSelect = (uri: string) => {
    setPhotoUri(uri);
  };

  const handleContinue = async () => {
    const trimmedName = name.trim();
    const cleanLogin = login.replace("@", "");

    if (cleanLogin.length < 3) {
      setError("Login must be at least 3 characters");
      return;
    }

    if (trimmedName.length < 2) {
      setError("Name must be at least 2 characters");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const user = getCurrentUser();

      if (!user) throw new Error("No authenticated user");

      const isAvailable = await isLoginAvailable(cleanLogin);

      if (!isAvailable) {
        setError("This login is already taken");
        setLoading(false);
        return;
      }

      let photoURL: string | null = null;

      if (photoUri) {
        photoURL = await uploadProfilePicture(photoUri, user.uid);
      }

      await updateUserProfile(cleanLogin, trimmedName, photoURL);

      refreshContext();

      router.replace("/main");
    } catch (err) {
      if (err instanceof AuthError || err instanceof FirestoreError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to save profile");
      }
    } finally {
      setLoading(false);
    }
  };

  return {
    name,
    login,
    photoUri,
    error,
    loading,
    handleNameChange,
    handleLoginChange,
    handlePhotoSelect,
    handleContinue,
  };
}
