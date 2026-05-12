import { COUNTRY_CODES } from "@/hooks/usePhoneAuth";

export function normalizePhoneNumber(phone: string, defaultCountryCode?: string): string {
  if (!phone) return "";

  let cleaned = phone.replace(/\D/g, "");

  // Check if it already starts with a known country code
  let startsWithKnownCode = false;

  for (const { code } of COUNTRY_CODES) {
    const numericCode = code.replace("+", "");
    
    if (cleaned.startsWith(numericCode)) {
      startsWithKnownCode = true;
      break;
    }
  }

  // If it doesn't start with a known code and we have a default, prepend the default
  if (!startsWithKnownCode && defaultCountryCode) {
    const numericDefault = defaultCountryCode.replace("+", "");
    cleaned = numericDefault + cleaned;
  }

  return "+" + cleaned;
}

export function getUserCountryCode(phoneNumber?: string | null): string | undefined {
  if (!phoneNumber) return undefined;
  
  for (const { code } of COUNTRY_CODES) {
    if (phoneNumber.startsWith(code)) {
      return code;
    }
  }
  return undefined;
}
