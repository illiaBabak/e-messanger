import { useRouter } from "expo-router";
import { useCallback, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { Colors, FontSizes } from "@/constants/theme";
import { useAuth } from "@/providers/AuthProvider";

export default function SplashScreen() {
  const router = useRouter();

  const { user, isProfileComplete, isLoading } = useAuth();

  const titleOpacity = useSharedValue(0);
  const titleScale = useSharedValue(0.8);
  const dotOpacity = useSharedValue(0);
  const screenOpacity = useSharedValue(1);

  const navigateNext = useCallback(() => {
    if (isLoading) return;

    if (!user) {
      router.replace("/auth");
    } else if (!isProfileComplete) {
      router.replace("/auth/create-profile");
    } else {
      router.replace("/main");
    }
  }, [router, user, isProfileComplete, isLoading]);

  useEffect(() => {
    titleOpacity.value = withTiming(1, {
      duration: 500,
      easing: Easing.out(Easing.cubic),
    });

    titleScale.value = withTiming(1, {
      duration: 500,
      easing: Easing.out(Easing.back(1.5)),
    });

    dotOpacity.value = withDelay(350, withTiming(1, { duration: 300 }));

    screenOpacity.value = withDelay(
      1200,
      withTiming(0, { duration: 400 }, (finished) => {
        if (finished) {
          scheduleOnRN(navigateNext);
        }
      })
    );
  }, [titleOpacity, titleScale, dotOpacity, screenOpacity, navigateNext]);

  const screenStyle = useAnimatedStyle(() => ({
    opacity: screenOpacity.value,
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ scale: titleScale.value }],
  }));

  const dotStyle = useAnimatedStyle(() => ({
    opacity: dotOpacity.value,
  }));

  return (
    <Animated.View style={[styles.container, screenStyle]}>
      <View style={styles.logoContainer}>
        <Animated.Text style={[styles.title, titleStyle]}>
          E-messanger
        </Animated.Text>
        <Animated.Text style={[styles.dot, dotStyle]}>.</Animated.Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  title: {
    fontSize: FontSizes.logo,
    fontWeight: "700",
    color: Colors.white,
    letterSpacing: -0.5,
  },
  dot: {
    fontSize: FontSizes.logo,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
});
