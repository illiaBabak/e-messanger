/**
 * Файл: app/auth/register.tsx
 *
 * Экран регистрации. Доступен по роуту /auth/register.
 *
 * Что здесь:
 * - Поля: имя, email, пароль (с toggle видимости)
 * - Кнопка "Create account" (primary)
 * - Разделитель "or"
 * - Кнопки входа через Google / Apple (для быстрой регистрации)
 * - Ссылка "Already have an account? Sign in" внизу → возврат на /auth
 *
 * Анимации — каскадное появление элементов (как на экране логина).
 * ScrollView — чтобы контент не обрезался на маленьких экранах.
 */

import { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import { TextInput } from "@/components/ui/text-input";
import { SocialButton } from "@/components/ui/social-button";
import { Divider } from "@/components/ui/divider";
import { Colors, FontSizes, Spacing, BorderRadius } from "@/constants/theme";

// Animated-обёртка для Pressable (чтобы кнопка могла анимироваться)
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function RegisterScreen() {
  const router = useRouter();

  // ─── Состояние формы ──────────────────────────────────────
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Ошибки валидации — пустая строка = ошибки нет
  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // ─── Анимации каскадного появления ────────────────────────
  const headerOpacity = useSharedValue(0);
  const headerTranslateY = useSharedValue(20);

  const formOpacity = useSharedValue(0);
  const formTranslateY = useSharedValue(20);

  const socialOpacity = useSharedValue(0);
  const socialTranslateY = useSharedValue(20);

  const footerOpacity = useSharedValue(0);

  // Анимация нажатия кнопки "Create account"
  const buttonScale = useSharedValue(1);

  useEffect(() => {
    const EASING = Easing.out(Easing.cubic);

    headerOpacity.value = withTiming(1, { duration: 500, easing: EASING });
    headerTranslateY.value = withTiming(0, { duration: 500, easing: EASING });

    formOpacity.value = withDelay(
      150,
      withTiming(1, { duration: 500, easing: EASING })
    );
    formTranslateY.value = withDelay(
      150,
      withTiming(0, { duration: 500, easing: EASING })
    );

    socialOpacity.value = withDelay(
      300,
      withTiming(1, { duration: 500, easing: EASING })
    );
    socialTranslateY.value = withDelay(
      300,
      withTiming(0, { duration: 500, easing: EASING })
    );

    footerOpacity.value = withDelay(
      400,
      withTiming(1, { duration: 500, easing: EASING })
    );
  }, [
    headerOpacity,
    headerTranslateY,
    formOpacity,
    formTranslateY,
    socialOpacity,
    socialTranslateY,
    footerOpacity,
  ]);

  // ─── Animated styles ──────────────────────────────────────
  const headerStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
    transform: [{ translateY: headerTranslateY.value }],
  }));

  const formStyle = useAnimatedStyle(() => ({
    opacity: formOpacity.value,
    transform: [{ translateY: formTranslateY.value }],
  }));

  const socialStyle = useAnimatedStyle(() => ({
    opacity: socialOpacity.value,
    transform: [{ translateY: socialTranslateY.value }],
  }));

  const footerStyle = useAnimatedStyle(() => ({
    opacity: footerOpacity.value,
  }));

  const buttonAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  // ─── Валидация ──────────────────────────────────────────────
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const HAS_LETTER_REGEX = /[a-zA-Zа-яА-ЯёЁ]/;

  const validateName = (value: string): string => {
    if (!value.trim()) return "Name is required";
    if (value.trim().length < 2) return "Name must be at least 2 characters";
    return "";
  };

  const validateEmail = (value: string): string => {
    if (!value.trim()) return "Email is required";
    if (!EMAIL_REGEX.test(value.trim())) return "Enter a valid email address";
    return "";
  };

  const validatePassword = (value: string): string => {
    if (!value) return "Password is required";
    if (value.length < 6) return "Password must be at least 6 characters";
    if (!HAS_LETTER_REGEX.test(value))
      return "Password must contain at least one letter";
    return "";
  };

  // ─── Обработчики ──────────────────────────────────────────
  const handleRegister = () => {
    const nErr = validateName(name);
    const eErr = validateEmail(email);
    const pErr = validatePassword(password);

    setNameError(nErr);
    setEmailError(eErr);
    setPasswordError(pErr);

    if (nErr || eErr || pErr) return;

    Alert.alert("Регистрация", `Имя: ${name}\nEmail: ${email}`);
  };

  const handleButtonPressIn = () => {
    buttonScale.value = withSpring(0.96, { damping: 15, stiffness: 150 });
  };

  const handleButtonPressOut = () => {
    buttonScale.value = withSpring(1, { damping: 15, stiffness: 150 });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ─── Хедер ─── */}
          <Animated.View style={[styles.header, headerStyle]}>
            {/* Кнопка «Назад» */}
            <Pressable style={styles.backButton} onPress={() => router.back()}>
              <Ionicons
                name="arrow-back"
                size={24}
                color={Colors.textPrimary}
              />
            </Pressable>

            <Text style={styles.title}>Create account</Text>
            <Text style={styles.subtitle}>
              Sign up to get started with E-messanger
            </Text>
          </Animated.View>

          {/* ─── Форма ─── */}
          <Animated.View style={[styles.form, formStyle]}>
            <TextInput
              leftIcon="person-outline"
              placeholder="Full name"
              value={name}
              onChangeText={(v) => {
                setName(v);
                if (nameError) setNameError(validateName(v));
              }}
              autoCapitalize="words"
              returnKeyType="next"
              error={nameError}
            />

            <View style={styles.fieldGap} />

            <TextInput
              leftIcon="mail-outline"
              placeholder="Email address"
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                if (emailError) setEmailError(validateEmail(v));
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              error={emailError}
            />

            <View style={styles.fieldGap} />

            <TextInput
              leftIcon="lock-closed-outline"
              placeholder="Password"
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                if (passwordError) setPasswordError(validatePassword(v));
              }}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              returnKeyType="done"
              rightIcon={showPassword ? "eye-off-outline" : "eye-outline"}
              onRightIconPress={() => setShowPassword((prev) => !prev)}
              error={passwordError}
            />

            {/* Кнопка регистрации */}
            <AnimatedPressable
              style={[styles.registerButton, buttonAnimStyle]}
              onPress={handleRegister}
              onPressIn={handleButtonPressIn}
              onPressOut={handleButtonPressOut}
            >
              <Text style={styles.registerButtonText}>Create account</Text>
            </AnimatedPressable>
          </Animated.View>

          {/* ─── Соцсети ─── */}
          <Animated.View style={socialStyle}>
            <Divider text="or sign up with" />

            <View style={styles.socialRow}>
              <SocialButton
                icon={<Ionicons name="logo-google" size={20} color="#4285F4" />}
                label="Google"
                onPress={() => Alert.alert("Google", "Sign up with Google")}
                style={styles.socialButtonHalf}
              />

              <SocialButton
                icon={
                  <Ionicons name="logo-apple" size={20} color={Colors.black} />
                }
                label="Apple"
                onPress={() => Alert.alert("Apple", "Sign up with Apple")}
                style={styles.socialButtonHalf}
              />
            </View>
          </Animated.View>

          {/* ─── Футер ─── */}
          <Animated.View style={[styles.footer, footerStyle]}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <Pressable onPress={() => router.back()}>
              <Text style={styles.footerLink}>Sign in</Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
  },

  // ─── Хедер ──────────────────────────────────────────────
  header: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.white,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: {
    fontSize: FontSizes.xl,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },

  // ─── Форма ──────────────────────────────────────────────
  form: {
    paddingBottom: Spacing.md,
  },
  fieldGap: {
    height: Spacing.sm + 4,
  },
  registerButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: "center",
    marginTop: Spacing.lg,
  },
  registerButtonText: {
    color: Colors.white,
    fontSize: FontSizes.md,
    fontWeight: "600",
  },

  // ─── Соцсети ────────────────────────────────────────────
  socialRow: {
    flexDirection: "row",
    gap: Spacing.sm + 4,
  },
  socialButtonHalf: {
    flex: 1,
  },

  // ─── Футер ──────────────────────────────────────────────
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.xl,
    marginTop: "auto",
  },
  footerText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  footerLink: {
    fontSize: FontSizes.sm,
    color: Colors.primary,
    fontWeight: "600",
  },
});
