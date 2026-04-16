import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OtpInput } from '@/components/ui/otp-input';
import {
  BorderRadius,
  Colors,
  FontSizes,
  Spacing,
} from '@/constants/theme';
import { useVerifyOtp } from '@/hooks/useVerifyOtp';

export default function VerifyOtpScreen() {
  const router = useRouter();

  const { phone } = useLocalSearchParams<{ phone: string }>();

  const {
    error,
    loading,
    resendTimer,
    handleComplete,
    handleResend,
  } = useVerifyOtp(phone);

  // Masking phone number: +380991234567 → +380 *** ** 67
  const maskedPhone = phone
    ? `${phone.slice(0, 4)} *** ** ${phone.slice(-2)}`
    : '';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>

        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </Pressable>

          <Text style={styles.title}>Verification code</Text>
          <Text style={styles.subtitle}>
            Enter the 6-digit code sent to{'\n'}
            <Text style={styles.phoneHighlight}>{maskedPhone}</Text>
          </Text>
        </View>

        <View style={styles.otpContainer}>
          {loading ? (
            <ActivityIndicator size="large" color={Colors.primary} />
          ) : (
            <OtpInput onComplete={handleComplete} error={error} />
          )}
        </View>
        
        <View style={styles.resendContainer}>
          {resendTimer > 0 ? (
            <Text style={styles.resendTimer}>
              Resend code in {resendTimer}s
            </Text>
          ) : (
            <Pressable onPress={handleResend}>
              <Text style={styles.resendLink}>Resend code</Text>
            </Pressable>
          )}
        </View>
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
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    lineHeight: 24,
  },
  phoneHighlight: {
    fontWeight: '600',
    color: Colors.textPrimary,
  },

  otpContainer: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
    minHeight: 100,
    justifyContent: 'center',
  },

  resendContainer: {
    alignItems: 'center',
    paddingTop: Spacing.md,
  },
  resendTimer: {
    fontSize: FontSizes.sm,
    color: Colors.textMuted,
  },
  resendLink: {
    fontSize: FontSizes.sm,
    color: Colors.primary,
    fontWeight: '600',
  },
});
