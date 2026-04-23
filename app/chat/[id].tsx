import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useMemo } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BorderRadius, Colors, FontSizes, Spacing } from "@/constants/theme";
import { useAuth } from "@/providers/AuthProvider";
import { useContacts } from "@/hooks/useContacts";

export default function ChatScreen() {
  const router = useRouter();

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
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.header}>
        <Pressable style={styles.headerLeft} onPress={handleBack}>
          <Ionicons name="chevron-back" size={28} color={Colors.primary} />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.headerName}>{name}</Text>
          <Text
            style={[
              styles.headerStatus,
              status === "online" && styles.headerStatusOnline,
            ]}
          >
            {status === "online" ? "Online" : "Offline"}
          </Text>
        </View>

        <Pressable style={styles.headerRight}>
          {decodedPhotoURL ? (
            <Image
              source={decodedPhotoURL}
              style={styles.avatarImage}
              contentFit="cover"
              transition={300}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>{name?.charAt(0) || "?"}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.messagesContainer}>
          {/* Messages list will be added here in the future */}
        </View>

        <SafeAreaView edges={["bottom"]} style={styles.footerSafeArea}>
          <View style={styles.inputContainer}>
            <Pressable style={styles.iconButton}>
              <Ionicons name="attach" size={26} color={Colors.textSecondary} />
            </Pressable>

            <TextInput
              style={styles.textInput}
              placeholder="Message..."
              placeholderTextColor={Colors.textMuted}
              value={message}
              onChangeText={setMessage}
              multiline
            />

            <Pressable style={styles.iconButton}>
              <Ionicons
                name={message.trim() ? "send" : "mic"}
                size={24}
                color={message.trim() ? Colors.primary : Colors.textSecondary}
              />
            </Pressable>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  headerLeft: {
    padding: Spacing.xs,
    minWidth: 40,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
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
  headerRight: {
    padding: Spacing.xs,
    minWidth: 40,
    alignItems: "flex-end",
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
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
  messagesContainer: {
    flex: 1,
  },
  footerSafeArea: {
    backgroundColor: Colors.white,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  textInput: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    maxHeight: 100,
    marginHorizontal: Spacing.sm,
  },
  iconButton: {
    padding: Spacing.xs,
    marginBottom: 4,
  },
});
