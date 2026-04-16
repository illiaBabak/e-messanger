import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { TextInput } from "@/components/ui/text-input";
import { BorderRadius, Colors, FontSizes, Spacing } from "@/constants/theme";
import { COUNTRY_CODES, usePhoneAuth } from "@/hooks/usePhoneAuth";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function PhoneScreen() {
  const router = useRouter();
  const [isCountryModalVisible, setCountryModalVisible] = useState(false);
  
  const {
    phone,
    selectedCountry,
    error,
    loading,
    handlePhoneChange,
    handleCountrySelect,
    handleSendCode,
  } = usePhoneAuth();

  const buttonScale = useSharedValue(1);

  const buttonAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.container}>

          <View style={styles.header}>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
              <Ionicons
                name="arrow-back"
                size={24}
                color={Colors.textPrimary}
              />
            </Pressable>

            <Text style={styles.title}>Enter your phone number</Text>
            <Text style={styles.subtitle}>
              {"We'll send you a verification code via SMS"}
            </Text>
          </View>

     
          <View style={styles.inputRow}>

            <Pressable style={styles.countryButton} onPress={() => setCountryModalVisible(true)}>
              <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
              <Text style={styles.countryCode}>{selectedCountry.code}</Text>
              <Ionicons
                name="chevron-down"
                size={14}
                color={Colors.textMuted}
              />
            </Pressable>


            <View style={styles.phoneInputWrapper}>
              <TextInput
                placeholder="Phone number"
                value={phone}
                onChangeText={handlePhoneChange}
                keyboardType="phone-pad"
                autoFocus
                returnKeyType="done"
                error={error}
              />
            </View>
          </View>


          <View style={styles.flex} />

          <AnimatedPressable
            style={[
              styles.sendButton,
              buttonAnimStyle,
              loading && styles.sendButtonDisabled,
            ]}
            onPress={handleSendCode}
            disabled={loading}
            onPressIn={() => {
              buttonScale.value = withSpring(0.97, {
                damping: 15,
                stiffness: 150,
              });
            }}
            onPressOut={() => {
              buttonScale.value = withSpring(1, {
                damping: 15,
                stiffness: 150,
              });
            }}
          >
            {loading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.sendButtonText}>Send code</Text>
            )}
          </AnimatedPressable>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={isCountryModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCountryModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalDismissArea} onPress={() => setCountryModalVisible(false)} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Country</Text>
              <Pressable onPress={() => setCountryModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </Pressable>
            </View>

            <FlatList
              data={COUNTRY_CODES}
              keyExtractor={(item) => item.code + item.name}
              showsVerticalScrollIndicator={false}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  style={styles.countryOption}
                  onPress={() => {
                    handleCountrySelect(index);
                    setCountryModalVisible(false);
                  }}
                >
                  <Text style={styles.countryOptionFlag}>{item.flag}</Text>
                  <View style={styles.countryOptionTextWrapper}>
                    <Text style={styles.countryOptionName}>{item.name}</Text>
                    <Text style={styles.countryOptionCode}>{item.code}</Text>
                  </View>
                  {selectedCountry.code === item.code && selectedCountry.name === item.name && (
                    <Ionicons name="checkmark" size={20} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
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

  inputRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  countryButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm + 4,
    height: 52,
    gap: 4,
  },
  countryFlag: {
    fontSize: 18,
  },
  countryCode: {
    fontSize: FontSizes.md,
    fontWeight: "500",
    color: Colors.textPrimary,
  },
  phoneInputWrapper: {
    flex: 1,
  },

  sendButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
  sendButtonDisabled: {
    opacity: 0.7,
  },
  sendButtonText: {
    color: Colors.white,
    fontSize: FontSizes.md,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: "flex-end",
  },
  modalDismissArea: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: "70%",
    paddingBottom: Spacing.xl,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  modalTitle: {
    fontSize: FontSizes.lg,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  countryOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  countryOptionFlag: {
    fontSize: 24,
    marginRight: Spacing.md,
  },
  countryOptionTextWrapper: {
    flex: 1,
    flexDirection: "row",
    gap: Spacing.sm,
  },
  countryOptionName: {
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    fontWeight: "500",
  },
  countryOptionCode: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
});
