import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors, FontSizes, Spacing } from "@/constants/theme";
import { useContacts } from "@/hooks/useContacts";
import { useAuth } from "@/providers/AuthProvider";

export default function ChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { contacts } = useContacts(user?.uid);

  const contact = useMemo(() => contacts.find((c) => c.id === id), [contacts, id]);

  const name = contact?.name || "Unknown";
  const status = contact?.status || "offline";
  const decodedPhotoURL = contact?.photoURL;

  const [message, setMessage] = useState("");

  const handleBack = () => {
    router.back();
  };

  return (
    <LinearGradient
      colors={["#7CB9E8", "#B594E6", "#F294C8"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.backgroundImage}
    >
      <ImageBackground
        source={require("@/assets/images/chat-bg.png")}
        style={styles.backgroundImage}
        imageStyle={styles.backgroundImageStyle}
      >
        <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.messagesContainer}
          contentContainerStyle={{
            paddingTop: insets.top + 60, // Space for the header
            paddingBottom: Spacing.xl,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Messages list will be added here in the future */}
        </ScrollView>

        <View style={[styles.headerContainer, { paddingTop: insets.top + Spacing.sm }]}>
          <Pressable style={styles.floatingCircle} onPress={handleBack}>
            <Ionicons name="chevron-back" size={24} color={Colors.primary} style={{ marginLeft: -2 }} />
          </Pressable>

          <View style={styles.floatingPill}>
            <Text style={styles.headerName}>{name}</Text>
            <Text
              style={[
                styles.headerStatus,
                status === "online" && styles.headerStatusOnline,
              ]}
            >
              {status === "online" ? "Online" : "Last seen recently"}
            </Text>
          </View>

          <Pressable style={styles.floatingAvatar}>
            {decodedPhotoURL ? (
              <Image
                source={decodedPhotoURL}
                style={styles.avatarImage}
                contentFit="cover"
                transition={300}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>
                  {name?.charAt(0) || "?"}
                </Text>
              </View>
            )}
          </Pressable>
        </View>

        <View
          style={[
            styles.footerContainer,
            { paddingBottom: Math.max(insets.bottom, Spacing.sm) },
          ]}
        >
          <Pressable style={styles.floatingCircle}>
            <Ionicons name="attach" size={24} color={Colors.textSecondary} />
          </Pressable>

          <View style={styles.floatingInputWrapper}>
            <TextInput
              style={styles.textInput}
              placeholder="Message"
              placeholderTextColor={Colors.textMuted}
              value={message}
              onChangeText={setMessage}
              multiline
            />
            <Pressable style={styles.stickerButton}>
              <Ionicons
                name="happy-outline"
                size={24}
                color={Colors.textSecondary}
              />
            </Pressable>
          </View>

          <Pressable style={styles.floatingCirclePrimary}>
            {message.trim() ? (
              <Ionicons name="arrow-up" size={24} color={Colors.white} />
            ) : (
              <Ionicons
                name="mic-outline"
                size={24}
                color={Colors.white}
              />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
      </ImageBackground>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
  },
  backgroundImageStyle: {
    opacity: 0.2, // Blend the pattern with the vibrant gradient
  },
  container: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  headerContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.sm,
    zIndex: 10,
  },
  floatingCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.9)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  floatingPill: {
    flex: 1,
    marginHorizontal: Spacing.sm,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 22,
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerName: {
    fontSize: FontSizes.md,
    fontWeight: "bold",
    color: Colors.textPrimary,
  },
  headerStatus: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  headerStatusOnline: {
    color: Colors.primary,
  },
  floatingAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.9)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    padding: 2,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 20,
  },
  avatarPlaceholder: {
    width: "100%",
    height: "100%",
    borderRadius: 20,
    backgroundColor: "#EBF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: FontSizes.md,
    fontWeight: "bold",
    color: Colors.primary,
  },
  footerContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  floatingInputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 22,
    marginHorizontal: Spacing.xs,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: "hidden",
  },
  textInput: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingTop: Platform.OS === "ios" ? 12 : 10,
    paddingBottom: Platform.OS === "ios" ? 12 : 10,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    maxHeight: 120,
    minHeight: 44,
  },
  stickerButton: {
    padding: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  floatingCirclePrimary: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
});
