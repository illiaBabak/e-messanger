import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { Divider } from "@/components/ui/divider";
import { SocialButton } from "@/components/ui/social-button";
import { BorderRadius, Colors, FontSizes, Spacing } from "@/constants/theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function AuthWelcomeScreen() {
  const router = useRouter();

  const logoOpacity = useSharedValue(0);
  const logoTranslateY = useSharedValue(30);

  const phoneOpacity = useSharedValue(0);
  const phoneTranslateY = useSharedValue(30);

  const socialOpacity = useSharedValue(0);
  const socialTranslateY = useSharedValue(30);

  const footerOpacity = useSharedValue(0);

  const phoneButtonScale = useSharedValue(1);

  useEffect(() => {
    const EASING = Easing.out(Easing.cubic);

    logoOpacity.value = withTiming(1, { duration: 600, easing: EASING });
    logoTranslateY.value = withTiming(0, { duration: 600, easing: EASING });

    phoneOpacity.value = withDelay(
      200,
      withTiming(1, { duration: 600, easing: EASING })
    );
    phoneTranslateY.value = withDelay(
      200,
      withTiming(0, { duration: 600, easing: EASING })
    );

    socialOpacity.value = withDelay(
      350,
      withTiming(1, { duration: 600, easing: EASING })
    );
    socialTranslateY.value = withDelay(
      350,
      withTiming(0, { duration: 600, easing: EASING })
    );

    footerOpacity.value = withDelay(
      500,
      withTiming(1, { duration: 600, easing: EASING })
    );
  }, [
    logoOpacity,
    logoTranslateY,
    phoneOpacity,
    phoneTranslateY,
    socialOpacity,
    socialTranslateY,
    footerOpacity,
  ]);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ translateY: logoTranslateY.value }],
  }));

  const phoneStyle = useAnimatedStyle(() => ({
    opacity: phoneOpacity.value,
    transform: [{ translateY: phoneTranslateY.value }],
  }));

  const socialStyle = useAnimatedStyle(() => ({
    opacity: socialOpacity.value,
    transform: [{ translateY: socialTranslateY.value }],
  }));

  const footerStyle = useAnimatedStyle(() => ({
    opacity: footerOpacity.value,
  }));

  const phoneButtonAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: phoneButtonScale.value }],
  }));


  const handlePhone = () => {
    router.push("/auth/phone");
  };

  const handleGoogle = () => {
    Alert.alert("Google Sign In", "Google auth will be connected here");
  };

  const handleApple = () => {
    Alert.alert("Apple Sign In", "Apple auth will be connected here");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Animated.View style={[styles.header, logoStyle]}>
          <View style={styles.logoRow}>
            <Text style={styles.logoText}>E-messanger</Text>
            <Text style={styles.logoDot}>.</Text>
          </View>
          <Text style={styles.subtitle}>Connect with friends and family</Text>
        </Animated.View>

        <Animated.View style={phoneStyle}>
          <AnimatedPressable
            style={[styles.phoneButton, phoneButtonAnimStyle]}
            onPress={handlePhone}
            onPressIn={() => {
              phoneButtonScale.value = withSpring(0.97, {
                damping: 15,
                stiffness: 150,
              });
            }}
            onPressOut={() => {
              phoneButtonScale.value = withSpring(1, {
                damping: 15,
                stiffness: 150,
              });
            }}
          >
            <Ionicons
              name="call-outline"
              size={20}
              color={Colors.white}
              style={styles.phoneIcon}
            />
            <Text style={styles.phoneButtonText}>
              Continue with phone number
            </Text>
          </AnimatedPressable>
        </Animated.View>


        <Animated.View style={socialStyle}>
          <Divider text="or" />

          <SocialButton
            icon={<Ionicons name="logo-google" size={20} color="#4285F4" />}
            label="Sign in with Google"
            onPress={handleGoogle}
          />

          <SocialButton
            icon={<Ionicons name="logo-apple" size={20} color={Colors.black} />}
            label="Sign in with Apple"
            onPress={handleApple}
            style={styles.socialSpacing}
          />
        </Animated.View>


        <Animated.View style={[styles.footer, footerStyle]}>
          <Text style={styles.footerText}>
            By continuing, you agree to our{" "}
            <Text style={styles.footerLink}>Terms of Service</Text> and{" "}
            <Text style={styles.footerLink}>Privacy Policy</Text>
          </Text>
        </Animated.View>
      </View>
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
  subtitle: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },

  phoneButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  phoneIcon: {
    marginRight: Spacing.sm,
  },
  phoneButtonText: {
    color: Colors.white,
    fontSize: FontSizes.md,
    fontWeight: "600",
  },

  socialSpacing: {
    marginTop: Spacing.sm + 4,
  },

  footer: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.md,
  },
  footerText: {
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
    textAlign: "center",
    lineHeight: 18,
  },
  footerLink: {
    color: Colors.primary,
    fontWeight: "500",
  },
});
