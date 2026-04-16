import { AuthError, sendOtp } from "@/services/auth";
import { useRouter } from "expo-router";
import { useState } from "react";

export const COUNTRY_CODES = [
  { code: "+380", flag: "🇺🇦", name: "UA" },
  { code: "+1", flag: "🇺🇸", name: "US" },
  { code: "+1", flag: "🇨🇦", name: "CA" },
  { code: "+44", flag: "🇬🇧", name: "UK" },
  { code: "+49", flag: "🇩🇪", name: "DE" },
  { code: "+33", flag: "🇫🇷", name: "FR" },
  { code: "+34", flag: "🇪🇸", name: "ES" },
  { code: "+39", flag: "🇮🇹", name: "IT" },
  { code: "+48", flag: "🇵🇱", name: "PL" },
  { code: "+7", flag: "🇰🇿", name: "KZ" },
  { code: "+91", flag: "🇮🇳", name: "IN" },
  { code: "+55", flag: "🇧🇷", name: "BR" },
  { code: "+81", flag: "🇯🇵", name: "JP" },
  { code: "+61", flag: "🇦🇺", name: "AU" },
  { code: "+86", flag: "🇨🇳", name: "CN" },
] as const;

export function usePhoneAuth() {
  const router = useRouter();

  const [phone, setPhone] = useState("");
  const [countryIndex, setCountryIndex] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedCountry = COUNTRY_CODES[countryIndex];

  const handleCountrySelect = (index: number) => {
    setCountryIndex(index);
  };

  const handlePhoneChange = (text: string) => {
    setPhone(text);

    if (error) {
      const digits = text.replace(/\D/g, "");

      if (digits.length >= 9) setError("");
    }
  };

  const getFullPhoneNumber = (): string => {
    const digits = phone.replace(/\D/g, "");

    return `${selectedCountry.code}${digits}`;
  };

  const validatePhone = (): string => {
    const digits = phone.replace(/\D/g, "");

    if (!digits) return "Enter your phone number";
    if (digits.length < 9) return "Phone number is too short";
    if (digits.length > 15) return "Phone number is too long";

    return "";
  };

  const handleSendCode = async () => {
    const validationError = validatePhone();

    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setLoading(true);

    try {
      const fullNumber = getFullPhoneNumber();
      await sendOtp(fullNumber);

      router.push({
        pathname: "/auth/verify-otp",
        params: { phone: fullNumber },
      });
    } catch (err) {
       if (err instanceof AuthError) {
         setError(err.message);
       } else if (err instanceof Error) {
         setError(err.message);
       } else {
         setError("Failed to send code");
       }
    } finally {
      setLoading(false);
    }
  };

  return {
    phone,
    countryIndex,
    selectedCountry,
    error,
    loading,
    handlePhoneChange,
    handleCountrySelect,
    handleSendCode,
  };
}
