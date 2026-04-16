import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TextInput } from '@/components/ui/text-input';
import {
  BorderRadius,
  Colors,
  FontSizes,
  Spacing,
} from '@/constants/theme';
import { useCreateProfile } from '@/hooks/useCreateProfile';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function CreateProfileScreen() {
  const {
    name,
    error,
    loading,
    handleNameChange,
    handleContinue,
  } = useCreateProfile();

  const buttonScale = useSharedValue(1);
  const buttonAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.container}>

          <View style={styles.header}>
            <View style={styles.avatarCircle}>
              <Ionicons name="person" size={40} color={Colors.primary} />
            </View>

            <Text style={styles.title}>{"What's your name?"}</Text>
            <Text style={styles.subtitle}>
              This is how others will see you in E-messanger
            </Text>
          </View>

          <TextInput
            leftIcon="person-outline"
            placeholder="Your name"
            value={name}
            onChangeText={handleNameChange}
            autoCapitalize="words"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleContinue}
            error={error}
          />

          <View style={styles.flex} />

          <AnimatedPressable
            style={[
              styles.continueButton,
              buttonAnimStyle,
              loading && styles.continueButtonDisabled,
            ]}
            onPress={handleContinue}
            disabled={loading}
            onPressIn={() => {
              buttonScale.value = withSpring(0.97, { damping: 15, stiffness: 150 });
            }}
            onPressOut={() => {
              buttonScale.value = withSpring(1, { damping: 15, stiffness: 150 });
            }}
          >
            {loading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.continueButtonText}>Get started</Text>
            )}
          </AnimatedPressable>
        </View>
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
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },

  header: {
    alignItems: 'center',
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xl,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EBF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  continueButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    opacity: 0.7,
  },
  continueButtonText: {
    color: Colors.white,
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
});
