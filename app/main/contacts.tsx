import { TextInput } from "@/components/ui/text-input";
import { BorderRadius, Colors, FontSizes, Spacing } from "@/constants/theme";
import { useAuth } from "@/providers/AuthProvider";
import { Ionicons } from "@expo/vector-icons";
import firestore from "@react-native-firebase/firestore";
import { router } from "expo-router";
import { Image } from "expo-image";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ContactProfile, useContacts } from "@/hooks/useContacts";
import { addContactToFirestore } from "@/services/firestore";

type SortOption = "name" | "lastTimeOnline";
type AddContactMethod = "phone" | "login";

export default function ContactsScreen() {
  const { user } = useAuth();
  const { contacts, isLoading: contactsLoading } = useContacts(user?.uid);

  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("lastTimeOnline");
  const [isSortPopoverVisible, setIsSortPopoverVisible] = useState(false);

  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [addMethod, setAddMethod] = useState<AddContactMethod>("phone");
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [newContactLogin, setNewContactLogin] = useState("");

  const [isSearching, setIsSearching] = useState(false);
  const [isNotFoundModalVisible, setIsNotFoundModalVisible] = useState(false);

  const sortedAndFilteredContacts = useMemo(() => {
    let result = [...contacts];

    if (searchQuery.trim().length > 0) {
      result = result.filter((c) =>
        c.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
      );
    }

    result.sort((a, b) => {
      if (sortOption === "name") {
        return a.name.localeCompare(b.name);
      } else {
        return b.lastSeenMs - a.lastSeenMs;
      }
    });

    return result;
  }, [contacts, searchQuery, sortOption]);

  const handleSaveContact = async () => {
    if (addMethod === "login" && !newContactLogin.trim()) {
      Alert.alert("Hold on", "Please enter a login.");
      return;
    }

    if (addMethod === "phone" && !newContactPhone.trim()) {
      Alert.alert("Hold on", "Please enter a phone number.");
      return;
    }

    if (!user?.uid) return;

    setIsSearching(true);

    try {
      let foundUserId: string | null = null;

      if (addMethod === "login") {
        const cleanLogin = newContactLogin.trim().toLowerCase();

        const usernameDoc = await firestore()
          .collection("usernames")
          .doc(cleanLogin)
          .get();

        if (usernameDoc.exists()) {
          foundUserId = usernameDoc.data()?.userId;
        }
      } else {
        const cleanPhone = newContactPhone.trim();
        const usersSnapshot = await firestore()
          .collection("users")
          .where("phoneNumber", "==", cleanPhone)
          .get();

        if (!usersSnapshot.empty) {
          foundUserId = usersSnapshot.docs[0].id;
        }
      }

      if (foundUserId) {
        if (foundUserId === user.uid) {
           Alert.alert("Hold on", "You cannot add yourself to contacts.");
           return;
        }
        
        await addContactToFirestore(user.uid, foundUserId, newContactName.trim() || undefined);

        setIsAddModalVisible(false);
        setNewContactName("");
        setNewContactPhone("");
        setNewContactLogin("");
      } else {
        setIsAddModalVisible(false);
        setTimeout(() => setIsNotFoundModalVisible(true), 300);
      }
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "We had trouble checking for that user. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleInviteFriend = async () => {
    try {
      if (!user?.uid) return;

      const userDoc = await firestore().collection("users").doc(user.uid).get();

      if (!userDoc.exists()) return;

      await Share.share({
        message: `Hey! Come chat with me on E-messenger. It's awesome! My login is @${
          userDoc.data()?.login || ""
        } 🚀`,
      });

      setIsNotFoundModalVisible(false);
    } catch (error) {
      console.error("Error sharing", error);
    }
  };

  const renderContact = ({ item }: { item: ContactProfile }) => (
    <Pressable 
      style={styles.contactItem}
      onPress={() => {
        router.push({
          pathname: "/chat/[id]",
          params: { id: item.id },
        });
      }}
    >
      <View style={styles.avatarPlaceholder}>
        {item.photoURL ? (
          <Image
            source={item.photoURL}
            style={styles.avatarImage}
            contentFit="cover"
            transition={300}
          />
        ) : (
          <Text style={styles.avatarInitial}>{item.name.charAt(0)}</Text>
        )}
      </View>
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{item.name}</Text>
        <Text
          style={[
            styles.contactStatus,
            item.status === "online" ? styles.contactStatusOnline : undefined,
          ]}
          numberOfLines={1}
        >
          {item.status === "online" ? "🟢 Online" : "Offline"}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable
            style={styles.headerButtonLeft}
            onPress={() => setIsSortPopoverVisible(true)}
          >
            <Text style={styles.headerButtonText}>Sort by</Text>
          </Pressable>

          <Text style={styles.headerTitle}>Contacts</Text>

          <Pressable
            style={styles.headerButtonRight}
            onPress={() => setIsAddModalVisible(true)}
          >
            <Ionicons name="add" size={28} color={Colors.primary} />
          </Pressable>
        </View>

        <View style={styles.searchContainer}>
          <TextInput
            placeholder="Search"
            leftIcon="search-outline"
            autoCapitalize="none"
            autoCorrect={false}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {contactsLoading ? (
          <View style={styles.emptyContainer}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        ) : (
          <FlatList
            data={sortedAndFilteredContacts}
            keyExtractor={(item) => item.id}
            renderItem={renderContact}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Not found</Text>
              </View>
            }
          />
        )}

        <Modal
          visible={isSortPopoverVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setIsSortPopoverVisible(false)}
        >
          <Pressable
            style={styles.popoverOverlay}
            onPress={() => setIsSortPopoverVisible(false)}
          >
            <SafeAreaView style={styles.popoverSafeArea}>
              <View style={styles.popoverContent}>
                <Pressable
                  style={styles.popoverOption}
                  onPress={() => {
                    setSortOption("name");
                    setIsSortPopoverVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.popoverOptionText,
                      sortOption === "name" && styles.popoverOptionTextSelected,
                    ]}
                  >
                    By name
                  </Text>
                  {sortOption === "name" && (
                    <Ionicons name="checkmark" size={20} color={Colors.primary} />
                  )}
                </Pressable>
                <View style={styles.popoverDivider} />
                <Pressable
                  style={styles.popoverOption}
                  onPress={() => {
                    setSortOption("lastTimeOnline");
                    setIsSortPopoverVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.popoverOptionText,
                      sortOption === "lastTimeOnline" &&
                        styles.popoverOptionTextSelected,
                    ]}
                  >
                    By last time online
                  </Text>
                  {sortOption === "lastTimeOnline" && (
                    <Ionicons name="checkmark" size={20} color={Colors.primary} />
                  )}
                </Pressable>
              </View>
            </SafeAreaView>
          </Pressable>
        </Modal>

        <Modal
          visible={isAddModalVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setIsAddModalVisible(false)}
        >
          <KeyboardAvoidingView
            style={styles.modalBg}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <View style={styles.modalHeader}>
              <Pressable
                onPress={() => setIsAddModalVisible(false)}
                style={styles.modalHeaderIconBtn}
              >
                <Ionicons name="close" size={28} color={Colors.textPrimary} />
              </Pressable>
              <Text style={styles.modalTitle}>New contact</Text>
              <Pressable
                onPress={handleSaveContact}
                style={styles.modalHeaderIconBtn}
                disabled={isSearching}
              >
                {isSearching ? (
                  <ActivityIndicator color={Colors.primary} />
                ) : (
                  <Ionicons name="checkmark" size={28} color={Colors.primary} />
                )}
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalBody}
              contentContainerStyle={styles.modalBodyContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <TextInput
                placeholder="Full name (Alias)"
                value={newContactName}
                onChangeText={setNewContactName}
                autoFocus
              />

              <View style={styles.methodTabs}>
                <Pressable
                  style={[
                    styles.methodTab,
                    addMethod === "phone" && styles.methodTabActive,
                  ]}
                  onPress={() => setAddMethod("phone")}
                >
                  <Text
                    style={[
                      styles.methodTabText,
                      addMethod === "phone" && styles.methodTabTextActive,
                    ]}
                  >
                    Phone
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.methodTab,
                    addMethod === "login" && styles.methodTabActive,
                  ]}
                  onPress={() => setAddMethod("login")}
                >
                  <Text
                    style={[
                      styles.methodTabText,
                      addMethod === "login" && styles.methodTabTextActive,
                    ]}
                  >
                    Login
                  </Text>
                </Pressable>
              </View>

              {addMethod === "phone" ? (
                <TextInput
                  placeholder="Phone number (e.g. +1...)"
                  keyboardType="phone-pad"
                  value={newContactPhone}
                  onChangeText={setNewContactPhone}
                />
              ) : (
                <TextInput
                  placeholder="Unique login"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={newContactLogin}
                  onChangeText={setNewContactLogin}
                />
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>

        <Modal
          visible={isNotFoundModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setIsNotFoundModalVisible(false)}
        >
          <View style={styles.overlayCentered}>
            <View style={styles.dialogBox}>
              <View style={styles.dialogIconContainer}>
                <Ionicons name="search" size={48} color={Colors.primary} />
                <View style={styles.dialogBadge}>
                  <Ionicons name="close" size={16} color={Colors.white} />
                </View>
              </View>
              <Text style={styles.dialogTitle}>User not found</Text>
              <Text style={styles.dialogMessage}>
                We couldn't find anyone going by that{" "}
                {addMethod === "phone" ? "phone number" : "login"}. Want to
                invite them to E-messenger?
              </Text>

              <View style={styles.dialogActions}>
                <Pressable
                  style={styles.dialogBtnSecondary}
                  onPress={() => setIsNotFoundModalVisible(false)}
                >
                  <Text style={styles.dialogBtnSecondaryText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={styles.dialogBtnPrimary}
                  onPress={handleInviteFriend}
                >
                  <Text style={styles.dialogBtnPrimaryText}>Invite friend</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
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
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  headerButtonLeft: {
    minWidth: 60,
    alignItems: "flex-start",
  },
  headerButtonRight: {
    minWidth: 60,
    alignItems: "flex-end",
  },
  headerButtonText: {
    color: Colors.primary,
    fontSize: FontSizes.md,
    fontWeight: "500",
  },
  headerTitle: {
    fontSize: FontSizes.lg,
    fontWeight: "bold",
    color: Colors.textPrimary,
  },
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#EBF2FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
    overflow: "hidden", // Important so images fit circular bound
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarInitial: {
    fontSize: FontSizes.lg,
    fontWeight: "bold",
    color: Colors.primary,
  },
  contactInfo: {
    flex: 1,
    justifyContent: "center",
  },
  contactName: {
    fontSize: FontSizes.md,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  contactStatus: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  contactStatusOnline: {
    color: Colors.primary, // Using primary blue for some pop on "Online"
    fontWeight: "500",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.md,
  },
  popoverOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  popoverSafeArea: {
    flex: 1,
  },
  popoverContent: {
    position: "absolute",
    top: 60,
    left: Spacing.lg,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    minWidth: 200,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  popoverOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  popoverOptionText: {
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
  },
  popoverOptionTextSelected: {
    color: Colors.primary,
    fontWeight: "500",
  },
  popoverDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.sm,
  },
  modalBg: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  modalHeaderIconBtn: {
    padding: Spacing.xs,
  },
  modalTitle: {
    fontSize: FontSizes.lg,
    fontWeight: "bold",
    color: Colors.textPrimary,
  },
  modalBody: {
    flex: 1,
  },
  modalBodyContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  methodTabs: {
    flexDirection: "row",
    backgroundColor: Colors.borderLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.xs,
  },
  methodTab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  methodTabActive: {
    backgroundColor: Colors.white,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  methodTabText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    fontWeight: "500",
  },
  methodTabTextActive: {
    color: Colors.textPrimary,
    fontWeight: "600",
  },
  overlayCentered: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  dialogBox: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    width: "100%",
    alignItems: "center",
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  dialogIconContainer: {
    marginBottom: Spacing.lg,
    position: "relative",
  },
  dialogBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    backgroundColor: Colors.error,
    borderRadius: BorderRadius.full,
    padding: 2,
    borderWidth: 2,
    borderColor: Colors.white,
  },
  dialogTitle: {
    fontSize: FontSizes.lg,
    fontWeight: "bold",
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  dialogMessage: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: "center",
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  dialogActions: {
    flexDirection: "row",
    gap: Spacing.md,
    width: "100%",
  },
  dialogBtnSecondary: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.borderLight,
    alignItems: "center",
  },
  dialogBtnSecondaryText: {
    color: Colors.textPrimary,
    fontSize: FontSizes.md,
    fontWeight: "600",
  },
  dialogBtnPrimary: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
    alignItems: "center",
  },
  dialogBtnPrimaryText: {
    color: Colors.white,
    fontSize: FontSizes.md,
    fontWeight: "600",
  },
});

