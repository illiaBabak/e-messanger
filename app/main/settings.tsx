import { BorderRadius, Colors, FontSizes, Spacing } from "@/constants/theme";
import { useAuth } from "@/providers/AuthProvider";
import { signOut } from "@/services/auth";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SettingsScreen() {
  const { user } = useAuth();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Settings</Text>

        <View style={styles.profileCard}>
          <Text style={styles.nameText}>
            {user?.displayName ?? "User"}
          </Text>
          <Text style={styles.emailText}>
            {user?.email ?? user?.phoneNumber ?? "No contact info"}
          </Text>
        </View>

        <Pressable style={styles.signOutButton} onPress={() => signOut()}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
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
    paddingTop: Spacing.lg,
  },
  title: {
    fontSize: FontSizes.xl,
    fontWeight: "bold",
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
  },
  profileCard: {
    backgroundColor: Colors.white,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.xl,
  },
  nameText: {
    fontSize: FontSizes.lg,
    fontWeight: "bold",
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  emailText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
  signOutButton: {
    backgroundColor: Colors.error,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  signOutText: {
    color: Colors.white,
    fontWeight: "bold",
    fontSize: FontSizes.md,
  },
});
