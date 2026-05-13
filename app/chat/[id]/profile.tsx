import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import MaskedView from "@react-native-masked-view/masked-view";
import type { StyleProp, ViewStyle } from "react-native";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BorderRadius, Colors, FontSizes, Spacing } from "@/constants/theme";
import { useChatsList } from "@/hooks/useChatsList";
import { useContactProfileDetails } from "@/hooks/useContactProfileDetails";
import { useContacts } from "@/hooks/useContacts";
import { useAuth } from "@/providers/AuthProvider";

const HERO_HEIGHT_RATIO = 0.58;
const PHOTO_OVERLAY_HEIGHT_RATIO = 0.38;
const PHOTO_OVERLAY_MIN_HEIGHT = 236;
const GLASS_BUTTON_SIZE = 38;
const TOP_BUTTON_BLUR_INTENSITY = 36;
const TOP_BUTTONS_READABLE_GRADIENT_HEIGHT = 130;
const TOP_GLASS_ICON_SIZE = 22;
const HERO_NAME_FONT_SIZE = 24;
const ACTION_TILE_HEIGHT = 66;
const ACTION_TILE_RADIUS = 20;
const ACTION_ICON_SIZE = 24;
const ACTION_TILE_HORIZONTAL_MARGIN = 7;
const MEDIA_COLUMN_COUNT = 3;
const MEDIA_TILE_GAP = 3;
const PROFILE_HERO_PLACEHOLDER_BLURHASH = "L6PZfSi_.AyE_3t7t7R**0o#DgR4";
const RECENT_LAST_SEEN_THRESHOLD_MS = 60_000;
const ONE_MINUTE_MS = 60_000;
const ONE_HOUR_MS = 60 * ONE_MINUTE_MS;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

type SearchParamValue = string | string[] | undefined;
type ProfileTab = "media" | "files";
type ProfileActionKey = "call" | "video" | "sound" | "search" | "more";

type ProfileAction = {
  key: ProfileActionKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

type ProfileMediaItem = {
  id: string;
  type: "image" | "video";
  thumbnailUri: string;
};

type ProfileFileItem = {
  id: string;
  name: string;
  sizeBytes?: number;
};

type GlassButtonProps = {
  children: ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
};

type ProfileActionButtonProps = {
  action: ProfileAction;
  onPress: () => void;
};

type MediaGridProps = {
  items: ProfileMediaItem[];
};

type FilesListProps = {
  items: ProfileFileItem[];
};

type ProfileInfoFieldProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
};

const PROFILE_ACTIONS: ProfileAction[] = [
  { key: "call", label: "Call", icon: "call" },
  { key: "video", label: "Video", icon: "videocam" },
  { key: "sound", label: "Sound", icon: "volume-high" },
  { key: "search", label: "Search", icon: "search" },
  { key: "more", label: "More", icon: "ellipsis-horizontal" },
];

// TODO: Replace these mocks with typed media extracted from chat messages when media indexing is added.
const MOCK_MEDIA_ITEMS: ProfileMediaItem[] = [
  {
    id: "mock-image-1",
    type: "image",
    thumbnailUri: "https://picsum.photos/seed/e-messenger-media-1/360/360",
  },
  {
    id: "mock-video-1",
    type: "video",
    thumbnailUri: "https://picsum.photos/seed/e-messenger-video-1/360/360",
  },
  {
    id: "mock-image-2",
    type: "image",
    thumbnailUri: "https://picsum.photos/seed/e-messenger-media-2/360/360",
  },
  {
    id: "mock-image-3",
    type: "image",
    thumbnailUri: "https://picsum.photos/seed/e-messenger-media-3/360/360",
  },
  {
    id: "mock-video-2",
    type: "video",
    thumbnailUri: "https://picsum.photos/seed/e-messenger-video-2/360/360",
  },
  {
    id: "mock-image-4",
    type: "image",
    thumbnailUri: "https://picsum.photos/seed/e-messenger-media-4/360/360",
  },
];

// TODO: Replace these mocks with typed files extracted from chat messages when file indexing is added.
const MOCK_FILE_ITEMS: ProfileFileItem[] = [
  { id: "mock-file-1", name: "Project brief.pdf", sizeBytes: 2_400_000 },
  { id: "mock-file-2", name: "Trip notes.docx", sizeBytes: 980_000 },
  { id: "mock-file-3", name: "Receipt archive.zip", sizeBytes: 5_700_000 },
];

function getSearchParamValue(value: SearchParamValue): string | undefined {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.find((item) => item.trim().length > 0);
  }

  return undefined;
}

function getInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

function formatLogin(login: string | undefined): string | undefined {
  if (!login) {
    return undefined;
  }

  return login.startsWith("@") ? login : `@${login}`;
}

function formatLastSeen(status: string, lastSeenMs: number | undefined): string {
  if (status === "online") {
    return "Online";
  }

  if (!lastSeenMs) {
    return "Last seen recently";
  }

  const now = Date.now();
  const diffMs = Math.max(now - lastSeenMs, 0);

  if (diffMs < RECENT_LAST_SEEN_THRESHOLD_MS) {
    return "Last seen just now";
  }

  if (diffMs < ONE_HOUR_MS) {
    return `Last seen ${Math.floor(diffMs / ONE_MINUTE_MS)} min ago`;
  }

  const date = new Date(lastSeenMs);

  if (diffMs < ONE_DAY_MS) {
    return `Last seen today at ${date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }

  if (diffMs < ONE_DAY_MS * 2) {
    return `Last seen yesterday at ${date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }

  return `Last seen ${date.toLocaleDateString([], {
    day: "2-digit",
    month: "short",
  })}`;
}

function formatFileSize(sizeBytes: number | undefined): string | undefined {
  if (sizeBytes === undefined) {
    return undefined;
  }

  if (sizeBytes < 1_000_000) {
    return `${Math.max(Math.round(sizeBytes / 1_000), 1)} KB`;
  }

  return `${(sizeBytes / 1_000_000).toFixed(1)} MB`;
}

function GlassButton({
  children,
  onPress,
  accessibilityLabel,
  style,
}: GlassButtonProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={[styles.glassButton, style]}
      hitSlop={Spacing.sm}
    >
      <View style={styles.glassButtonSurface}>
        <BlurView
          intensity={TOP_BUTTON_BLUR_INTENSITY}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.topGlassButtonOverlay} />
      </View>
      <View style={styles.glassButtonContent}>{children}</View>
    </Pressable>
  );
}

function ProfileActionButton({ action, onPress }: ProfileActionButtonProps) {
  return (
    <Pressable style={styles.actionButton} onPress={onPress}>
      <BlurView intensity={26} tint="light" style={StyleSheet.absoluteFill} />
      <View style={styles.actionButtonTint} />
      <Ionicons name={action.icon} size={ACTION_ICON_SIZE} color={Colors.white} />
      <Text style={styles.actionLabel} numberOfLines={1}>
        {action.label}
      </Text>
    </Pressable>
  );
}

function ProfileInfoField({ icon, label, value }: ProfileInfoFieldProps) {
  return (
    <View style={styles.infoFieldCard}>
      <View style={styles.infoIconShell}>
        <Ionicons name={icon} size={20} color={Colors.primary} />
      </View>
      <View style={styles.infoFieldTextGroup}>
        <Text style={styles.infoFieldLabel}>{label}</Text>
        <Text style={styles.infoFieldValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function MediaGrid({ items }: MediaGridProps) {
  if (items.length === 0) {
    return <EmptyState label="No media yet" icon="images-outline" />;
  }

  return (
    <View style={styles.mediaGrid}>
      {items.map((item) => (
        <Pressable key={item.id} style={styles.mediaTileOuter}>
          <View style={styles.mediaTile}>
            <Image
              source={item.thumbnailUri}
              style={styles.mediaThumbnail}
              contentFit="cover"
              transition={200}
            />
            {item.type === "video" && (
              <View style={styles.videoPlayBadge}>
                <Ionicons name="play" size={18} color={Colors.white} />
              </View>
            )}
          </View>
        </Pressable>
      ))}
    </View>
  );
}

function FilesList({ items }: FilesListProps) {
  if (items.length === 0) {
    return <EmptyState label="No files yet" icon="document-outline" />;
  }

  return (
    <View style={styles.filesList}>
      {items.map((item) => {
        const fileSize = formatFileSize(item.sizeBytes);

        return (
          <Pressable key={item.id} style={styles.fileItem}>
            <View style={styles.fileIconShell}>
              <Ionicons name="document-text-outline" size={24} color={Colors.primary} />
            </View>
            <View style={styles.fileTextGroup}>
              <Text style={styles.fileName} numberOfLines={1}>
                {item.name}
              </Text>
              {fileSize ? (
                <Text style={styles.fileSize} numberOfLines={1}>
                  {fileSize}
                </Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function EmptyState({
  label,
  icon,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name={icon} size={32} color={Colors.textMuted} />
      <Text style={styles.emptyText}>{label}</Text>
    </View>
  );
}

export default function ContactProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const params = useLocalSearchParams();
  const contactId = getSearchParamValue(params.id);
  const routeName = getSearchParamValue(params.name);
  const routeStatus = getSearchParamValue(params.status);
  const routePhotoURL = getSearchParamValue(params.photoURL);
  const routeLastSeenMs = Number(getSearchParamValue(params.lastSeenMs));

  const { user } = useAuth();
  const { contacts } = useContacts(user?.uid);
  const { chats } = useChatsList(user?.uid);
  const { profile, errorMessage } = useContactProfileDetails(contactId);
  const [selectedTab, setSelectedTab] = useState<ProfileTab>("media");

  const contactInfo = useMemo(
    () => contacts.find((contact) => contact.id === contactId),
    [contactId, contacts],
  );
  const chatInfo = useMemo(
    () => chats.find((chat) => chat.friendId === contactId),
    [contactId, chats],
  );
  const fallbackLastSeenMs = Number.isFinite(routeLastSeenMs)
    ? routeLastSeenMs
    : contactInfo?.lastSeenMs;

  const displayName = profile?.name ?? contactInfo?.name ?? chatInfo?.name ?? routeName ?? "Unknown";
  const displayStatus = profile?.status ?? contactInfo?.status ?? chatInfo?.status ?? routeStatus ?? "offline";
  const profileHeroImageUrl =
    profile?.profilePhotoLargeUrl ??
    profile?.profileImageUrl ??
    profile?.profilePhotoUrl ??
    profile?.photoURL ??
    profile?.avatarUrl ??
    contactInfo?.photoURL ??
    chatInfo?.photoURL ??
    routePhotoURL;
  const lowerIdentity = formatLogin(profile?.login) ?? displayName;
  const phoneNumber = profile?.phoneNumber;
  const statusText = formatLastSeen(displayStatus, profile?.lastSeenMs ?? fallbackLastSeenMs);
  const heroHeight = windowHeight * HERO_HEIGHT_RATIO;
  const overlayHeight = Math.max(heroHeight * PHOTO_OVERLAY_HEIGHT_RATIO, PHOTO_OVERLAY_MIN_HEIGHT);

  const handleBack = useCallback((): void => {
    router.back();
  }, [router]);

  const handlePlaceholderAction = useCallback((): void => {
    // TODO: Wire profile actions to real call, search, edit, and notification flows.
  }, []);

  const handleSelectMedia = useCallback((): void => {
    setSelectedTab("media");
  }, []);

  const handleSelectFiles = useCallback((): void => {
    setSelectedTab("files");
  }, []);

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.photoSection, { height: heroHeight }]}>
          {profileHeroImageUrl ? (
            <Image
              source={profileHeroImageUrl}
              style={styles.heroImage}
              contentFit="cover"
              placeholder={PROFILE_HERO_PLACEHOLDER_BLURHASH}
              placeholderContentFit="cover"
              priority="high"
              cachePolicy="memory-disk"
              transition={300}
            />
          ) : (
            <View style={styles.heroFallback}>
              <Text style={styles.heroInitial}>{getInitial(displayName)}</Text>
            </View>
          )}
          <LinearGradient
            pointerEvents="none"
            colors={["rgba(0, 0, 0, 0.24)", "rgba(0, 0, 0, 0)"]}
            locations={[0, 1]}
            style={styles.topButtonsReadableGradient}
          />

          <View style={[styles.heroTopButtons, { top: insets.top + Spacing.sm }]}>
            <GlassButton accessibilityLabel="Back to chat" onPress={handleBack}>
              <Ionicons
                name="chevron-back"
                size={TOP_GLASS_ICON_SIZE}
                color={Colors.white}
                style={styles.topGlassButtonIcon}
              />
            </GlassButton>

            <GlassButton
              accessibilityLabel="Edit contact"
              onPress={handlePlaceholderAction}
              style={styles.editGlassButton}
            >
              <Text style={styles.editButtonText}>Edit</Text>
            </GlassButton>
          </View>

          <View
            pointerEvents="box-none"
            style={[styles.photoInfoOverlay, { height: overlayHeight }]}
          >
            <MaskedView
              androidRenderingMode="hardware"
              style={StyleSheet.absoluteFill}
              maskElement={
                <LinearGradient
                  colors={[
                    "rgba(0, 0, 0, 0)",
                    "rgba(0, 0, 0, 0.08)",
                    "rgba(0, 0, 0, 0.3)",
                    "rgba(0, 0, 0, 0.68)",
                    "rgba(0, 0, 0, 1)",
                  ]}
                  locations={[0, 0.26, 0.52, 0.78, 1]}
                  style={StyleSheet.absoluteFill}
                />
              }
            >
              <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
            </MaskedView>
            <LinearGradient
              pointerEvents="none"
              colors={[
                "rgba(0, 0, 0, 0)",
                "rgba(0, 0, 0, 0.08)",
                "rgba(0, 0, 0, 0.24)",
                "rgba(0, 0, 0, 0.48)",
                "rgba(0, 0, 0, 0.72)",
              ]}
              locations={[0, 0.25, 0.5, 0.76, 1]}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.photoInfoContent}>
              <Text style={styles.heroName} numberOfLines={1}>
                {displayName}
              </Text>
              <Text
                style={[
                  styles.heroStatus,
                  displayStatus === "online" && styles.heroStatusOnline,
                ]}
                numberOfLines={1}
              >
                {statusText}
              </Text>

              <View style={styles.actionRow}>
                {PROFILE_ACTIONS.map((action) => (
                  <ProfileActionButton
                    key={action.key}
                    action={action}
                    onPress={handlePlaceholderAction}
                  />
                ))}
              </View>
            </View>
          </View>
        </View>

        <View style={styles.contentSection}>
          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>Info</Text>
            <ProfileInfoField
              icon={profile?.login ? "at-outline" : "person-outline"}
              label="Login"
              value={lowerIdentity}
            />
            {phoneNumber ? (
              <ProfileInfoField
                icon="call-outline"
                label="Phone"
                value={phoneNumber}
              />
            ) : null}
            {errorMessage ? (
              <Text style={styles.errorText}>{errorMessage}</Text>
            ) : null}
          </View>

          <View style={styles.toggleContainer}>
            <Pressable
              style={[
                styles.toggleButton,
                selectedTab === "media" && styles.toggleButtonSelected,
              ]}
              onPress={handleSelectMedia}
            >
              <Text
                style={[
                  styles.toggleText,
                  selectedTab === "media" && styles.toggleTextSelected,
                ]}
              >
                Media
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.toggleButton,
                selectedTab === "files" && styles.toggleButtonSelected,
              ]}
              onPress={handleSelectFiles}
            >
              <Text
                style={[
                  styles.toggleText,
                  selectedTab === "files" && styles.toggleTextSelected,
                ]}
              >
                Files
              </Text>
            </Pressable>
          </View>

          {selectedTab === "media" ? (
            <MediaGrid items={MOCK_MEDIA_ITEMS} />
          ) : (
            <FilesList items={MOCK_FILE_ITEMS} />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  scrollView: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  scrollContent: {
    backgroundColor: Colors.white,
  },
  photoSection: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#EAF2FF",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EAF2FF",
  },
  heroInitial: {
    fontSize: 96,
    fontWeight: "700",
    color: Colors.primary,
  },
  heroTopButtons: {
    position: "absolute",
    left: Spacing.md,
    right: Spacing.md,
    zIndex: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topButtonsReadableGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: TOP_BUTTONS_READABLE_GRADIENT_HEIGHT,
    zIndex: 4,
  },
  glassButton: {
    minWidth: GLASS_BUTTON_SIZE,
    height: GLASS_BUTTON_SIZE,
    borderRadius: GLASS_BUTTON_SIZE / 2,
    backgroundColor: "rgba(0, 0, 0, 0.32)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.35)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  glassButtonSurface: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: GLASS_BUTTON_SIZE / 2,
    overflow: "hidden",
  },
  topGlassButtonOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.22)",
  },
  glassButtonContent: {
    flex: 1,
    minWidth: GLASS_BUTTON_SIZE,
    paddingHorizontal: Spacing.xs,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  topGlassButtonIcon: {
    textShadowColor: "rgba(0, 0, 0, 0.45)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  editGlassButton: {
    minWidth: 64,
  },
  editButtonText: {
    fontSize: FontSizes.sm,
    fontWeight: "600",
    color: Colors.white,
    textShadowColor: "rgba(0, 0, 0, 0.45)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  photoInfoOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden",
  },
  photoInfoContent: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    zIndex: 2,
  },
  heroName: {
    fontSize: HERO_NAME_FONT_SIZE,
    fontWeight: "700",
    color: Colors.white,
    textAlign: "left",
  },
  heroStatus: {
    marginTop: Spacing.xs,
    fontSize: FontSizes.sm,
    color: "rgba(255, 255, 255, 0.82)",
    textAlign: "left",
  },
  heroStatusOnline: {
    color: "#BFF7D1",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginTop: Spacing.md,
    marginHorizontal: -ACTION_TILE_HORIZONTAL_MARGIN,
  },
  actionButton: {
    flex: 1,
    height: ACTION_TILE_HEIGHT,
    borderRadius: ACTION_TILE_RADIUS,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: ACTION_TILE_HORIZONTAL_MARGIN,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.22)",
  },
  actionButtonTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(116, 116, 116, 0.28)",
  },
  actionLabel: {
    marginTop: Spacing.xs,
    fontSize: FontSizes.xs,
    fontWeight: "600",
    color: Colors.white,
    textAlign: "center",
  },
  contentSection: {
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  infoSection: {
    paddingBottom: Spacing.lg,
  },
  sectionTitle: {
    marginBottom: Spacing.sm,
    fontSize: FontSizes.sm,
    fontWeight: "700",
    color: Colors.textSecondary,
    textTransform: "uppercase",
  },
  infoFieldCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceLight,
    marginBottom: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderLight,
  },
  infoIconShell: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EBF2FF",
    marginRight: Spacing.md,
  },
  infoFieldTextGroup: {
    flex: 1,
  },
  infoFieldLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
  },
  infoFieldValue: {
    marginTop: Spacing.xs,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    fontWeight: "600",
  },
  errorText: {
    marginTop: Spacing.sm,
    fontSize: FontSizes.sm,
    color: Colors.error,
  },
  toggleContainer: {
    flexDirection: "row",
    padding: Spacing.xs,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surfaceLight,
    marginBottom: Spacing.md,
  },
  toggleButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleButtonSelected: {
    backgroundColor: Colors.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  toggleText: {
    fontSize: FontSizes.sm,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  toggleTextSelected: {
    color: Colors.textPrimary,
  },
  mediaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -MEDIA_TILE_GAP,
    paddingBottom: Spacing.md,
  },
  mediaTileOuter: {
    width: `${100 / MEDIA_COLUMN_COUNT}%`,
    padding: MEDIA_TILE_GAP,
  },
  mediaTile: {
    aspectRatio: 1,
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
    backgroundColor: Colors.borderLight,
  },
  mediaThumbnail: {
    width: "100%",
    height: "100%",
  },
  videoPlayBadge: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.18)",
  },
  filesList: {
    paddingBottom: Spacing.md,
  },
  fileItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  fileIconShell: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EBF2FF",
    marginRight: Spacing.md,
  },
  fileTextGroup: {
    flex: 1,
  },
  fileName: {
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    fontWeight: "500",
  },
  fileSize: {
    marginTop: Spacing.xs,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  emptyState: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    marginTop: Spacing.sm,
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
});
