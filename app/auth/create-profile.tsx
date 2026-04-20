import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import {
  ActivityIndicator,
  Image,
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
import { SaveFormat } from 'expo-image-manipulator';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function CreateProfileScreen() {
  const {
    name,
    login,
    photoUri,
    error,
    loading,
    handleNameChange,
    handleLoginChange,
    handlePhotoSelect,
    handleContinue,
  } = useCreateProfile();

  const buttonScale = useSharedValue(1);
  const buttonAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const handleAvatarPress = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        const manipContext = ImageManipulator.ImageManipulator.manipulate(result.assets[0].uri);

        manipContext.resize({ width: 600, height: 600 });

        const imageRef = await manipContext.renderAsync();

        const manipResult = await imageRef.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
        
        handlePhotoSelect(manipResult.uri);
      }
    } catch (err) {
      console.error('Failed to pick image', err);
    }
  };

  const getInitials = () => {
    if (name.trim().length > 0) {
      return name.trim().charAt(0).toUpperCase();
    }
    if (login.replace('@', '').length > 0) {
      return login.replace('@', '').charAt(0).toUpperCase();
    }
    return null;
  };

  const initials = getInitials();

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.container}>

          <View style={styles.header}>
            <Pressable onPress={handleAvatarPress} style={styles.avatarContainer}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.avatarImage} />
              ) : (
                <View style={[styles.avatarCircle, initials ? styles.avatarCircleInitials : null]}>
                  {initials ? (
                    <Text style={styles.initialsText}>{initials}</Text>
                  ) : (
                    <Ionicons name="person" size={40} color={Colors.primary} />
                  )}
                </View>
              )}
              <View style={styles.cameraIconContainer}>
                <Ionicons name="camera" size={16} color={Colors.white} />
              </View>
            </Pressable>

            <Text style={styles.title}>{"Create Profile"}</Text>
            <Text style={styles.subtitle}>
              This is how others will see you in E-messenger
            </Text>
          </View>

          <View style={styles.inputsContainer}>
            <TextInput
              leftIcon="at-outline"
              placeholder="login"
              value={login}
              onChangeText={handleLoginChange}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              error={error?.toLowerCase().includes("login") ? error : undefined}
            />

            <TextInput
              leftIcon="person-outline"
              placeholder="Your name"
              value={name}
              onChangeText={handleNameChange}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={handleContinue}
              error={error && !error.toLowerCase().includes("login") ? error : undefined}
            />
          </View>

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
  avatarContainer: {
    position: 'relative',
    marginBottom: Spacing.lg,
  },
  avatarCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#EBF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircleInitials: {
    backgroundColor: Colors.primary,
  },
  avatarImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  initialsText: {
    fontSize: 36,
    fontWeight: '700',
    color: Colors.white,
  },
  cameraIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
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
  inputsContainer: {
    gap: Spacing.md,
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
