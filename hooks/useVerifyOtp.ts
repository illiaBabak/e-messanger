import { AuthError, sendOtp, verifyOtp } from "@/services/auth";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";

const RESEND_TIMER = 60;

export function useVerifyOtp(phone: string | undefined) {
  const router = useRouter();

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(RESEND_TIMER);

  // Timer for Resend logic
  useEffect(() => {
    if (resendTimer <= 0) return;

    const interval = setInterval(() => {
      setResendTimer((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleComplete = useCallback(async (code: string) => {
    setError("");
    setLoading(true);

    try {
      const user = await verifyOtp(code);

      if (!user.displayName) {
        router.replace("/auth/create-profile");
      } else {
        router.replace("/main");
      }
    } catch (err) {
      if (err instanceof AuthError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Invalid code");
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  const handleResend = useCallback(async () => {
    if (resendTimer > 0 || !phone) return;

    try {
      await sendOtp(phone);
      setResendTimer(RESEND_TIMER);
      setError("");
    } catch (err) {
      if (err instanceof AuthError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to resend");
      }
    }
  }, [resendTimer, phone]);

  return {
    error,
    loading,
    resendTimer,
    handleComplete,
    handleResend,
  };
}
