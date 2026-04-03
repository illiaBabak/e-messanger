/**
 * Файл: app/auth/index.tsx
 *
 * Экран логина/регистрации. Expo Router автоматически подхватывает этот файл
 * по пути /auth (потому что он лежит в app/auth/index.tsx).
 *
 * Что здесь происходит:
 * 1. При монтировании — все элементы плавно появляются снизу вверх
 *    (каждый следующий элемент с небольшой задержкой → «каскадный» эффект)
 * 2. Кнопки Google и Apple пока вызывают Alert (заглушка)
 * 3. Внизу — ссылка "Already have an account? Sign in here"
 *
 * SafeAreaView из react-native-safe-area-context (НЕ из react-native!) —
 * корректно обрабатывает вырезы, Dynamic Island и home indicator на всех
 * устройствах. Версия из react-native давно deprecated.
 */

import { useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import { SocialButton } from "@/components/ui/social-button";
import { Divider } from "@/components/ui/divider";
import { Colors, FontSizes, Spacing, BorderRadius } from "@/constants/theme";

export default function AuthScreen() {
  const router = useRouter();
  // ─── Анимации появления ────────────────────────────────
  // Каждый блок (лого, кнопки, разделитель, ссылка) имеет свой
  // opacity и translateY, чтобы они появлялись «каскадом»
  const logoOpacity = useSharedValue(0);
  const logoTranslateY = useSharedValue(30);

  const buttonsOpacity = useSharedValue(0);
  const buttonsTranslateY = useSharedValue(30);

  const dividerOpacity = useSharedValue(0);

  const footerOpacity = useSharedValue(0);
  const footerTranslateY = useSharedValue(20);

  useEffect(() => {
    const EASING = Easing.out(Easing.cubic);

    logoOpacity.value = withTiming(1, { duration: 600, easing: EASING });
    logoTranslateY.value = withTiming(0, { duration: 600, easing: EASING });

    buttonsOpacity.value = withDelay(
      200,
      withTiming(1, { duration: 600, easing: EASING })
    );
    buttonsTranslateY.value = withDelay(
      200,
      withTiming(0, { duration: 600, easing: EASING })
    );

    dividerOpacity.value = withDelay(
      400,
      withTiming(1, { duration: 600, easing: EASING })
    );

    footerOpacity.value = withDelay(
      500,
      withTiming(1, { duration: 600, easing: EASING })
    );
    footerTranslateY.value = withDelay(
      500,
      withTiming(0, { duration: 600, easing: EASING })
    );
  }, [
    logoOpacity,
    logoTranslateY,
    buttonsOpacity,
    buttonsTranslateY,
    dividerOpacity,
    footerOpacity,
    footerTranslateY,
  ]);

  // ─── Animated styles ──────────────────────────────────────
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ translateY: logoTranslateY.value }],
  }));

  const buttonsStyle = useAnimatedStyle(() => ({
    opacity: buttonsOpacity.value,
    transform: [{ translateY: buttonsTranslateY.value }],
  }));

  const dividerStyle = useAnimatedStyle(() => ({
    opacity: dividerOpacity.value,
  }));

  const footerStyle = useAnimatedStyle(() => ({
    opacity: footerOpacity.value,
    transform: [{ translateY: footerTranslateY.value }],
  }));

  // ─── Заглушки для кнопок ──────────────────────────────────
  const handleGoogleSignIn = () => {
    Alert.alert("Google Sign In", "Здесь будет логин через Google");
  };

  const handleAppleSignIn = () => {
    Alert.alert("Apple Sign In", "Здесь будет логин через Apple");
  };

  const handlePhoneSignIn = () => {
    Alert.alert("Phone Sign In", "Здесь будет логин по номеру телефона");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* ─── Верхняя часть: логотип ─── */}
        <Animated.View style={[styles.header, logoStyle]}>
          <View style={styles.logoRow}>
            <Text style={styles.logoText}>E-messanger</Text>
            <Text style={styles.logoDot}>.</Text>
          </View>
        </Animated.View>

        {/* ─── Центральная часть: кнопки входа ─── */}
        <Animated.View style={[styles.content, buttonsStyle]}>
          <SocialButton
            icon={<Ionicons name="logo-google" size={20} color="#4285F4" />}
            label="Sign in with Google"
            onPress={handleGoogleSignIn}
          />

          <SocialButton
            icon={<Ionicons name="logo-apple" size={20} color={Colors.black} />}
            label="Sign in with Apple"
            onPress={handleAppleSignIn}
            style={styles.buttonSpacing}
          />

          <Animated.View style={dividerStyle}>
            <Divider />
          </Animated.View>

          <Pressable style={styles.phoneButton} onPress={handlePhoneSignIn}>
            <Ionicons
              name="call-outline"
              size={20}
              color={Colors.textPrimary}
              style={styles.phoneIcon}
            />
            <Text style={styles.phoneButtonText}>
              Continue with phone number
            </Text>
          </Pressable>
        </Animated.View>

        {/* ─── Нижняя часть: ссылка на регистрацию ─── */}
        <Animated.View style={[styles.footer, footerStyle]}>
          <Text style={styles.footerText}>{"Don't have an account?"}</Text>
          <Pressable onPress={() => router.push("/auth/register")}>
            <Text style={styles.footerLink}>Sign up</Text>
          </Pressable>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },

  header: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 120,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  logoText: {
    fontSize: FontSizes.xxl,
    fontWeight: "700",
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  logoDot: {
    fontSize: FontSizes.xxl,
    fontWeight: "700",
    color: Colors.primary,
  },

  content: {
    paddingBottom: Spacing.lg,
  },
  buttonSpacing: {
    marginTop: Spacing.sm + 4,
  },

  phoneButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  phoneIcon: {
    marginRight: Spacing.sm,
  },
  phoneButtonText: {
    fontSize: FontSizes.md,
    fontWeight: "500",
    color: Colors.textPrimary,
  },

  footer: {
    alignItems: "center",
    paddingBottom: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  footerText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  footerLink: {
    fontSize: FontSizes.sm,
    color: Colors.primary,
    fontWeight: "600",
    marginTop: Spacing.xs,
  },
});
