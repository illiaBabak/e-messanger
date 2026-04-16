import { AuthError, updateUserProfile } from "@/services/auth";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useAuth } from "@/providers/AuthProvider";

export function useCreateProfile() {
  const router = useRouter();
  const { refreshContext } = useAuth();

  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleNameChange = (text: string) => {
    setName(text);
    
    if (error && text.trim().length >= 2) 
      setError("");
  };

  const handleContinue = async () => {
    const trimmed = name.trim();

    if (trimmed.length < 2) {
      setError("Name must be at least 2 characters");
      return;
    }

    setError("");
    setLoading(true);

    try {
      await updateUserProfile(trimmed);
      refreshContext();

      router.replace("/main");
    } catch (err) {
      if (err instanceof AuthError) {
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
    error,
    loading,
    handleNameChange,
    handleContinue,
  };
}
