import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { BorderRadius, Colors, FontSizes, Spacing } from "@/constants/theme";

interface OtpInputProps {
  length?: number;
  onComplete: (code: string) => void;
  error?: string;
}

export function OtpInput({ length = 6, onComplete, error }: OtpInputProps) {
  const [code, setCode] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleChange = (text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, length);
    setCode(digits);

    if (digits.length === length) {
      onComplete(digits);
    }
  };

  const handlePress = () => {
    inputRef.current?.focus();
  };

  return (
    <View>
      <TextInput
        ref={inputRef}
        value={code}
        onChangeText={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        maxLength={length}
        style={styles.hiddenInput}
        autoFocus
      />

      <Pressable style={styles.cellRow} onPress={handlePress}>
        {Array.from({ length }, (_, index) => {
          const digit = code[index] ?? "";
          const isActive = focused && index === code.length;
          const isFilled = digit !== "";

          return (
            <OtpCell
              key={index}
              digit={digit}
              isActive={isActive}
              isFilled={isFilled}
              hasError={!!error}
            />
          );
        })}
      </Pressable>

      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

interface OtpCellProps {
  digit: string;
  isActive: boolean;
  isFilled: boolean;
  hasError: boolean;
}

function OtpCell({ digit, isActive, isFilled, hasError }: OtpCellProps) {
  const scale = useSharedValue(1);

  if (isActive) {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 600 }),
        withTiming(1, { duration: 600 })
      ),
      -1,
      true
    );
  } else {
    scale.value = withSpring(isFilled ? 1.02 : 1);
  }

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const borderColor = hasError
    ? Colors.error
    : isActive
    ? Colors.primary
    : isFilled
    ? Colors.primaryDark
    : Colors.border;

  return (
    <Animated.View
      style={[
        styles.cell,
        { borderColor },
        isFilled && styles.cellFilled,
        animStyle,
      ]}
    >
      <Text style={[styles.cellText, hasError && styles.cellTextError]}>
        {digit}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hiddenInput: {
    position: "absolute",
    opacity: 0,
    height: 0,
    width: 0,
  },
  cellRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.sm + 2,
  },
  cell: {
    width: 48,
    height: 56,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  cellFilled: {
    backgroundColor: "#F0F4FF",
  },
  cellText: {
    fontSize: FontSizes.xl,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  cellTextError: {
    color: Colors.error,
  },
  errorText: {
    color: Colors.error,
    fontSize: FontSizes.xs,
    textAlign: "center",
    marginTop: Spacing.sm,
  },
});
