import { Ionicons } from "@expo/vector-icons";
import { useEventListener } from "expo";
import { VideoView, useVideoPlayer } from "expo-video";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  GestureResponderEvent,
  LayoutChangeEvent,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/theme";
import type { SelectedChatMedia, VideoTrimRange } from "@/types/chatMedia";
import { hasVideoTrimChanged, trimVideoAsync } from "@/utils/videoTrim";
import {
  hasPreviewActions,
  PreviewActionsMenu,
  type PreviewActions,
} from "./PreviewActionsMenu";

const { width } = Dimensions.get("window");
const MIN_TRIM_DURATION_MS = 1000;
const MS_PER_SECOND = 1000;
const SEEK_STEP_SECONDS = 15;
const PLAYER_PROGRESS_INTERVAL_MS = 250;
const CONTROLS_AUTO_HIDE_DELAY_MS = 2500;
const END_DETECTION_THRESHOLD_MS = 300;
const TRACK_HEIGHT = 36;
const HANDLE_SIZE = 26;
const HEADER_RESERVED_HEIGHT = 92;
const BOTTOM_PANEL_RESERVED_HEIGHT = 176;
const CHAT_PLAYER_BOTTOM_PADDING = 28;

export type VideoPreviewModalProps = {
  visible: boolean;
  video: SelectedChatMedia | null;
  title: string;
  timeStr?: string;
  showTrimControls: boolean;
  autoPlay?: boolean;
  showActionsMenu?: boolean;
  showSendButton?: boolean;
  actions?: VideoPreviewActions;
  onClose: () => void;
  onSend?: (video: SelectedChatMedia) => Promise<void> | void;
};

export type VideoPreviewActions = PreviewActions;

const clamp = (value: number, min: number, max: number): number => {
  if (max < min) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
};

const formatTime = (milliseconds: number): string => {
  const safeMs = Math.max(0, milliseconds);
  const totalSeconds = Math.floor(safeMs / MS_PER_SECOND);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

const getInitialRange = (durationMs: number | undefined): VideoTrimRange => ({
  startMs: 0,
  endMs: durationMs && durationMs > 0 ? durationMs : 0,
});

const getDurationMs = (
  mediaDurationMs: number | undefined,
  playerDurationMs: number | undefined,
): number | undefined => {
  if (mediaDurationMs && mediaDurationMs > 0) {
    return mediaDurationMs;
  }

  return playerDurationMs && playerDurationMs > 0 ? playerDurationMs : undefined;
};

const isPlaybackAtEnd = (currentTimeMs: number, durationMs: number): boolean =>
  durationMs > 0 && currentTimeMs >= durationMs - END_DETECTION_THRESHOLD_MS;

export const VideoPreviewModal = ({
  visible,
  video,
  title,
  timeStr,
  showTrimControls,
  autoPlay = false,
  showActionsMenu = false,
  showSendButton,
  actions,
  onClose,
  onSend,
}: VideoPreviewModalProps) => {
  const insets = useSafeAreaInsets();
  const [trimRange, setTrimRange] = useState<VideoTrimRange>(() => getInitialRange(video?.duration));
  const [trackWidth, setTrackWidth] = useState(0);
  const [progressTrackWidth, setProgressTrackWidth] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [isPlayerLoading, setIsPlayerLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [playerDurationMs, setPlayerDurationMs] = useState<number | undefined>(undefined);
  const [areControlsVisible, setAreControlsVisible] = useState(true);
  const [actionsMenuVisible, setActionsMenuVisible] = useState(false);

  const videoSource = useMemo(() => (video?.uri ? { uri: video.uri } : null), [video?.uri]);
  const player = useVideoPlayer(videoSource, (videoPlayer) => {
    videoPlayer.loop = false;
    videoPlayer.keepScreenOnWhilePlaying = true;
    videoPlayer.timeUpdateEventInterval = PLAYER_PROGRESS_INTERVAL_MS / MS_PER_SECOND;
  });

  const durationMs = useMemo(
    () => getDurationMs(video?.duration, playerDurationMs),
    [playerDurationMs, video?.duration],
  );

  const trimRangeRef = useRef(trimRange);
  const dragStartRangeRef = useRef(trimRange);
  const durationRef = useRef(durationMs);
  const trackWidthRef = useRef(trackWidth);
  const progressTrackWidthRef = useRef(progressTrackWidth);
  const currentTimeRef = useRef(currentTimeMs);
  const controlsAutoHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    trimRangeRef.current = trimRange;
  }, [trimRange]);

  useEffect(() => {
    durationRef.current = durationMs;
  }, [durationMs]);

  useEffect(() => {
    trackWidthRef.current = trackWidth;
  }, [trackWidth]);

  useEffect(() => {
    progressTrackWidthRef.current = progressTrackWidth;
  }, [progressTrackWidth]);

  useEffect(() => {
    currentTimeRef.current = currentTimeMs;
  }, [currentTimeMs]);

  useEffect(() => {
    setTrimRange(getInitialRange(durationMs));
  }, [durationMs, video?.uri]);

  useEventListener(player, "playingChange", ({ isPlaying: nextIsPlaying }) => {
    setIsPlaying(nextIsPlaying);
  });

  useEventListener(player, "timeUpdate", ({ currentTime }) => {
    const nextTimeMs = Math.round(currentTime * MS_PER_SECOND);
    const currentDurationMs = durationRef.current;
    setCurrentTimeMs(clamp(nextTimeMs, 0, currentDurationMs ?? nextTimeMs));
  });

  useEventListener(player, "sourceLoad", ({ duration }) => {
    const nextDurationMs = duration > 0 ? Math.round(duration * MS_PER_SECOND) : undefined;
    setPlayerDurationMs(nextDurationMs);
    setCurrentTimeMs(0);
    setIsPlayerLoading(false);

    if (visible && autoPlay) {
      player.play();
      setIsPlaying(true);
    }
  });

  useEventListener(player, "playToEnd", () => {
    const currentDurationMs = durationRef.current;
    setIsPlaying(false);
    setAreControlsVisible(true);

    if (currentDurationMs) {
      setCurrentTimeMs(currentDurationMs);
    }
  });

  useEffect(() => {
    if (!visible) {
      player.pause();
      setIsSending(false);
      setIsPlaying(false);
      setActionsMenuVisible(false);
      return;
    }

    if (video?.uri) {
      setIsPlayerLoading(true);
      setPlayerDurationMs(undefined);
      setCurrentTimeMs(0);
      setAreControlsVisible(true);

      if (autoPlay) {
        player.play();
        setIsPlaying(true);
      } else {
        player.pause();
        setIsPlaying(false);
      }
    }
  }, [autoPlay, player, video?.uri, visible]);

  const clearControlsAutoHideTimeout = useCallback(() => {
    if (controlsAutoHideTimeoutRef.current) {
      clearTimeout(controlsAutoHideTimeoutRef.current);
      controlsAutoHideTimeoutRef.current = null;
    }
  }, []);

  const scheduleControlsAutoHide = useCallback(() => {
    clearControlsAutoHideTimeout();

    if (!isPlaying) {
      return;
    }

    controlsAutoHideTimeoutRef.current = setTimeout(() => {
      setAreControlsVisible(false);
    }, CONTROLS_AUTO_HIDE_DELAY_MS);
  }, [clearControlsAutoHideTimeout, isPlaying]);

  useEffect(() => {
    if (areControlsVisible && isPlaying) {
      scheduleControlsAutoHide();
      return;
    }

    clearControlsAutoHideTimeout();
  }, [areControlsVisible, clearControlsAutoHideTimeout, isPlaying, scheduleControlsAutoHide]);

  useEffect(() => clearControlsAutoHideTimeout, [clearControlsAutoHideTimeout]);

  const seekToMs = useCallback(
    (milliseconds: number) => {
      const currentDurationMs = durationRef.current;
      const nextTimeMs = clamp(milliseconds, 0, currentDurationMs ?? Math.max(0, milliseconds));
      player.currentTime = nextTimeMs / MS_PER_SECOND;
      setCurrentTimeMs(nextTimeMs);
      setAreControlsVisible(true);
    },
    [player],
  );

  const togglePlayback = useCallback(() => {
    const currentDurationMs = durationRef.current;
    const videoEnded = Boolean(
      currentDurationMs && isPlaybackAtEnd(currentTimeRef.current, currentDurationMs),
    );
    const shouldPause = !videoEnded && (isPlaying || player.playing);

    if (shouldPause) {
      player.pause();
      setIsPlaying(false);
      setAreControlsVisible(true);
      return;
    }

    if (videoEnded) {
      player.currentTime = 0;
      setCurrentTimeMs(0);
    }

    player.play();
    setIsPlaying(true);
    setAreControlsVisible(true);
  }, [isPlaying, player]);

  const seekBySeconds = useCallback(
    (seconds: number) => {
      seekToMs(currentTimeRef.current + seconds * MS_PER_SECOND);
    },
    [seekToMs],
  );

  const handlePlayerTap = useCallback(() => {
    if (!areControlsVisible) {
      setAreControlsVisible(true);
      return;
    }

    if (isPlaying) {
      setAreControlsVisible(false);
    }
  }, [areControlsVisible, isPlaying]);

  const handleProgressTrackLayout = useCallback((event: LayoutChangeEvent) => {
    setProgressTrackWidth(event.nativeEvent.layout.width);
  }, []);

  const handleProgressPress = useCallback(
    (event: GestureResponderEvent) => {
      const currentDurationMs = durationRef.current;
      const currentProgressTrackWidth = progressTrackWidthRef.current;

      if (!currentDurationMs || currentProgressTrackWidth <= 0) {
        return;
      }

      const nextProgress = clamp(event.nativeEvent.locationX / currentProgressTrackWidth, 0, 1);
      seekToMs(nextProgress * currentDurationMs);
    },
    [seekToMs],
  );

  const handleFirstFrameRender = useCallback(() => {
    setIsPlayerLoading(false);

    const nextDurationMs = player.duration > 0 ? Math.round(player.duration * MS_PER_SECOND) : undefined;

    if (player.duration > 0) {
      setPlayerDurationMs(nextDurationMs);
    }

    setCurrentTimeMs(
      clamp(Math.round(player.currentTime * MS_PER_SECOND), 0, durationRef.current ?? nextDurationMs ?? 0),
    );

    if (autoPlay && visible && !player.playing) {
      player.play();
      setIsPlaying(true);
    }
  }, [autoPlay, player, visible]);

  const updateStartHandle = useCallback(
    (dx: number) => {
      const currentDuration = durationRef.current;
      const currentTrackWidth = trackWidthRef.current;
      const baseRange = dragStartRangeRef.current;

      if (!currentDuration || currentTrackWidth <= 0) {
        return;
      }

      const deltaMs = (dx / currentTrackWidth) * currentDuration;
      const maxStartMs = Math.max(0, baseRange.endMs - MIN_TRIM_DURATION_MS);
      const nextStartMs = Math.min(Math.max(0, Math.round(baseRange.startMs + deltaMs)), maxStartMs);
      const nextRange = { ...trimRangeRef.current, startMs: nextStartMs };

      setTrimRange(nextRange);
      seekToMs(nextRange.startMs);
    },
    [seekToMs],
  );

  const updateEndHandle = useCallback(
    (dx: number) => {
      const currentDuration = durationRef.current;
      const currentTrackWidth = trackWidthRef.current;
      const baseRange = dragStartRangeRef.current;

      if (!currentDuration || currentTrackWidth <= 0) {
        return;
      }

      const deltaMs = (dx / currentTrackWidth) * currentDuration;
      const minEndMs = Math.min(currentDuration, baseRange.startMs + MIN_TRIM_DURATION_MS);
      const nextEndMs = Math.max(
        minEndMs,
        Math.min(currentDuration, Math.round(baseRange.endMs + deltaMs)),
      );
      const nextRange = { ...trimRangeRef.current, endMs: nextEndMs };

      setTrimRange(nextRange);
      seekToMs(nextRange.endMs);
    },
    [seekToMs],
  );

  const leftHandlePanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          dragStartRangeRef.current = trimRangeRef.current;
        },
        onPanResponderMove: (_event, gestureState) => {
          updateStartHandle(gestureState.dx);
        },
      }),
    [updateStartHandle],
  );

  const rightHandlePanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          dragStartRangeRef.current = trimRangeRef.current;
        },
        onPanResponderMove: (_event, gestureState) => {
          updateEndHandle(gestureState.dx);
        },
      }),
    [updateEndHandle],
  );

  const handleTrackLayout = (event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  };

  const trimChanged = hasVideoTrimChanged(trimRange, durationMs);
  const canShowSendButton = Boolean((showSendButton ?? Boolean(onSend)) && onSend);
  const canShowActionsMenu = showActionsMenu && hasPreviewActions(actions);
  const hasBottomPanel = showTrimControls || canShowSendButton;
  const canRenderTrimControls = showTrimControls && Boolean(durationMs && durationMs > MIN_TRIM_DURATION_MS);
  const selectedLeft = durationMs && trackWidth > 0 ? (trimRange.startMs / durationMs) * trackWidth : 0;
  const selectedWidth =
    durationMs && trackWidth > 0
      ? ((trimRange.endMs - trimRange.startMs) / durationMs) * trackWidth
      : 0;
  const currentDurationMs = durationMs ?? 0;
  const clampedCurrentTimeMs = clamp(currentTimeMs, 0, currentDurationMs);
  const progress = currentDurationMs > 0 ? clampedCurrentTimeMs / currentDurationMs : 0;
  const progressFillWidth = progressTrackWidth * progress;
  const progressThumbLeft = clamp(progressFillWidth - 5, 0, Math.max(0, progressTrackWidth - 10));
  const playerPaddingBottom = hasBottomPanel
    ? BOTTOM_PANEL_RESERVED_HEIGHT + Math.max(insets.bottom, 16)
    : CHAT_PLAYER_BOTTOM_PADDING + Math.max(insets.bottom, 16);
  const actionsMenuTop = Math.max(insets.top, 20) + 44;

  const handleSend = async () => {
    if (!video || !onSend || isSending) {
      return;
    }

    try {
      setIsSending(true);

      let videoToSend = video;

      if (trimChanged) {
        const trimmedVideo = await trimVideoAsync({
          uri: video.uri,
          fileName: video.fileName ?? "video.mp4",
          mimeType: video.mimeType ?? "video/mp4",
          startMs: trimRange.startMs,
          endMs: trimRange.endMs,
        });

        videoToSend = {
          ...video,
          uri: trimmedVideo.uri,
          fileName: trimmedVideo.fileName,
          mimeType: trimmedVideo.mimeType,
          duration: trimRange.endMs - trimRange.startMs,
        };
      }

      await onSend(videoToSend);
    } catch (error) {
      console.error("Failed to send video", error);
      Alert.alert("Video Error", "Could not send this video.");
    } finally {
      setIsSending(false);
    }
  };

  const titleText = video?.fileName || title;
  const disableSend = isSending || !video?.uri;

  if (!video) {
    return null;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
          <Pressable onPress={onClose} style={styles.iconButton} disabled={isSending}>
            <Ionicons name="close" size={26} color={Colors.white} />
          </Pressable>

          <View style={styles.headerTextContainer}>
            <Text style={styles.titleText} numberOfLines={1}>
              {titleText}
            </Text>
            {timeStr ? <Text style={styles.timeText}>{timeStr}</Text> : null}
          </View>

          {canShowActionsMenu ? (
            <Pressable
              onPress={() => setActionsMenuVisible(true)}
              style={styles.iconButton}
              disabled={isSending}
            >
              <Ionicons name="ellipsis-vertical" size={24} color={Colors.white} />
            </Pressable>
          ) : (
            <View style={styles.headerSpacer} />
          )}
        </View>

        {canShowActionsMenu && actions ? (
          <PreviewActionsMenu
            visible={actionsMenuVisible}
            top={actionsMenuTop}
            actions={actions}
            onClose={() => setActionsMenuVisible(false)}
          />
        ) : null}

        <View
          style={[
            styles.playerContainer,
            {
              paddingTop: HEADER_RESERVED_HEIGHT + Math.max(insets.top, 0),
              paddingBottom: playerPaddingBottom,
            },
          ]}
        >
          <View style={styles.playerSurface}>
            <VideoView
              player={player}
              nativeControls={false}
              contentFit="contain"
              fullscreenOptions={{
                enable: true,
              }}
              style={styles.video}
              onFirstFrameRender={handleFirstFrameRender}
            />
            <Pressable style={StyleSheet.absoluteFill} onPress={handlePlayerTap} />

            {areControlsVisible ? (
              <View style={styles.controlsOverlay} pointerEvents="box-none">
                <View style={styles.centerControls} pointerEvents="box-none">
                  <View style={styles.centerControlsRow}>
                    <Pressable
                      style={styles.secondaryControlButton}
                      onPress={() => seekBySeconds(-SEEK_STEP_SECONDS)}
                      hitSlop={10}
                    >
                      <Ionicons name="play-back" size={24} color={Colors.white} />
                      <Text style={styles.seekText}>{SEEK_STEP_SECONDS}</Text>
                    </Pressable>

                    <Pressable style={styles.playPauseButton} onPress={togglePlayback} hitSlop={10}>
                      <Ionicons name={isPlaying ? "pause" : "play"} size={34} color={Colors.white} />
                    </Pressable>

                    <Pressable
                      style={styles.secondaryControlButton}
                      onPress={() => seekBySeconds(SEEK_STEP_SECONDS)}
                      hitSlop={10}
                    >
                      <Ionicons name="play-forward" size={24} color={Colors.white} />
                      <Text style={styles.seekText}>{SEEK_STEP_SECONDS}</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.progressControls}>
                  <Text style={styles.progressTimeText}>
                    {formatTime(clampedCurrentTimeMs)} / {formatTime(currentDurationMs)}
                  </Text>
                  <Pressable
                    style={styles.progressTrackPressable}
                    onLayout={handleProgressTrackLayout}
                    onPress={handleProgressPress}
                  >
                    <View style={styles.progressTrackBase} />
                    <View style={[styles.progressTrackFill, { width: progressFillWidth }]} />
                    <View style={[styles.progressThumb, { left: progressThumbLeft }]} />
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>

          {isPlayerLoading && (
            <View style={styles.playerLoadingOverlay} pointerEvents="none">
              <ActivityIndicator size="large" color={Colors.white} />
            </View>
          )}
        </View>

        {hasBottomPanel ? (
          <View style={[styles.bottomControls, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            {showTrimControls ? (
              <View style={styles.trimContainer}>
                <View style={styles.trimHeader}>
                  <Ionicons name="cut" size={18} color={Colors.white} />
                  <Text style={styles.trimRangeText}>
                    {formatTime(trimRange.startMs)} — {formatTime(trimRange.endMs)}
                  </Text>
                </View>

                {canRenderTrimControls ? (
                  <View style={styles.timelineRow}>
                    <Text style={styles.timelineEdgeText}>0:00</Text>
                    <View style={styles.track} onLayout={handleTrackLayout}>
                      <View style={styles.trackBase} />
                      <View
                        style={[
                          styles.selectedTrack,
                          {
                            left: selectedLeft,
                            width: selectedWidth,
                          },
                        ]}
                      />
                      <View
                        style={[styles.trimHandle, { left: selectedLeft - HANDLE_SIZE / 2 }]}
                        {...leftHandlePanResponder.panHandlers}
                      >
                        <View style={styles.handleGrip} />
                      </View>
                      <View
                        style={[styles.trimHandle, { left: selectedLeft + selectedWidth - HANDLE_SIZE / 2 }]}
                        {...rightHandlePanResponder.panHandlers}
                      >
                        <View style={styles.handleGrip} />
                      </View>
                    </View>
                    <Text style={styles.timelineEdgeText}>{formatTime(durationMs ?? 0)}</Text>
                  </View>
                ) : (
                  <View style={styles.timelineLoadingContainer}>
                    <ActivityIndicator size="small" color={Colors.white} />
                  </View>
                )}

              </View>
            ) : null}

            {canShowSendButton ? (
              <Pressable
                style={[styles.sendButton, disableSend && styles.sendButtonDisabled]}
                onPress={handleSend}
                disabled={disableSend}
              >
                {isSending ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <>
                    <Text style={styles.sendButtonText}>Send</Text>
                    <Ionicons name="send" size={18} color={Colors.white} />
                  </>
                )}
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  iconButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 21,
  },
  headerTextContainer: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  titleText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: "700",
    maxWidth: width - 132,
  },
  timeText: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    marginTop: 2,
  },
  headerSpacer: {
    width: 42,
  },
  playerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  playerSurface: {
    flex: 1,
    width: "100%",
    position: "relative",
    overflow: "hidden",
  },
  video: {
    width: "100%",
    height: "100%",
  },
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  centerControls: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  centerControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 34,
    backgroundColor: "rgba(0,0,0,0.32)",
  },
  secondaryControlButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.48)",
  },
  playPauseButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.58)",
  },
  seekText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: "800",
    marginTop: -2,
  },
  progressControls: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 18,
    gap: 8,
  },
  progressTimeText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  progressTrackPressable: {
    height: 28,
    justifyContent: "center",
  },
  progressTrackBase: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.36)",
  },
  progressTrackFill: {
    position: "absolute",
    left: 0,
    top: 12,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.white,
  },
  progressThumb: {
    position: "absolute",
    top: 9,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.white,
  },
  playerLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  bottomControls: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 14,
    paddingHorizontal: 16,
    backgroundColor: "rgba(0,0,0,0.68)",
    gap: 14,
  },
  trimContainer: {
    gap: 10,
  },
  trimHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  trimRangeText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: "700",
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  timelineEdgeText: {
    width: 42,
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    textAlign: "center",
  },
  track: {
    flex: 1,
    height: TRACK_HEIGHT,
    justifyContent: "center",
  },
  trackBase: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  selectedTrack: {
    position: "absolute",
    top: (TRACK_HEIGHT - 10) / 2,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  trimHandle: {
    position: "absolute",
    top: (TRACK_HEIGHT - HANDLE_SIZE) / 2,
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    borderRadius: HANDLE_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.white,
  },
  handleGrip: {
    width: 4,
    height: 14,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
  timelineLoadingContainer: {
    height: TRACK_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  trimNoticeText: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    textAlign: "center",
  },
  sendButton: {
    minHeight: 46,
    borderRadius: 23,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: "700",
  },
});
