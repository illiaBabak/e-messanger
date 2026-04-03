/**
 * Файл: components/ui/social-button.tsx
 *
 * Переиспользуемая кнопка для входа через соцсети (Google, Apple и т.д.).
 *
 * Props:
 * - icon: React-элемент иконки (передаём снаружи)
 * - label: текст на кнопке ("Sign in with Google")
 * - onPress: обработчик нажатия
 * - style: дополнительные стили (опционально)
 *
 * Анимация:
 * При нажатии кнопка слегка сжимается (scale 0.97) — это даёт
 * тактильный feedback без вибрации.
 */

import { StyleSheet, Pressable, View, Text, ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";

import { Colors, FontSizes, BorderRadius, Spacing } from "@/constants/theme";

// Animated.createAnimatedComponent оборачивает обычный RN-компонент,
// чтобы он мог принимать animated styles
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface SocialButtonProps {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  style?: ViewStyle;
}

export function SocialButton({
  icon,
  label,
  onPress,
  style,
}: SocialButtonProps) {
  // scale для анимации нажатия
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    // withSpring — пружинная анимация, более «живая» чем withTiming
    scale.value = withSpring(0.97, { damping: 15, stiffness: 150 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 150 });
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.button, animatedStyle, style]}
    >
      <View style={styles.iconContainer}>{icon}</View>
      <Text style={styles.label}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  iconContainer: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  label: {
    fontSize: FontSizes.md,
    fontWeight: "500",
    color: Colors.textPrimary,
  },
});
