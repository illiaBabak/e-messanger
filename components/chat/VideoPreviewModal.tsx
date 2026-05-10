import { Ionicons } from "@expo/vector-icons";
import { useEventListener } from "expo";
import { VideoView, useVideoPlayer } from "expo-video";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  LayoutChangeEvent,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/theme";
import type { SelectedChatMedia, VideoTrimRange } from "@/types/chatMedia";
import { getCachedMediaUriAsync } from "@/utils/mediaCache";
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
const PLAYER_PROGRESS_INTERVAL_MS = 500;
const CONTROLS_AUTO_HIDE_DELAY_MS = 2500;
const END_DETECTION_THRESHOLD_MS = 300;
const SEEK_LOCK_RELEASE_DELAY_MS = 120;
const TRACK_HEIGHT = 36;
const HANDLE_SIZE = 26;
const PROGRESS_THUMB_SIZE = 10;
const HEADER_RESERVED_HEIGHT = 86;
const GALLERY_HEADER_RESERVED_HEIGHT = 70;
const BOTTOM_PANEL_RESERVED_HEIGHT = 136;
const GALLERY_BOTTOM_PANEL_RESERVED_HEIGHT = 118;
const CHAT_PLAYER_BOTTOM_PADDING = 20;
const CHAT_PLAYER_HORIZONTAL_PADDING = 8;
const GALLERY_PLAYER_HORIZONTAL_PADDING = 0;
const GALLERY_PLAYER_SURFACE_WIDTH_RATIO = 0.99;
const PREPARING_VIDEO_LABEL = "Preparing video...";

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

type PlaybackRange = {
  startMs: number;
  endMs: number;
};

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

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
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

const isPlaybackAtRangeEnd = (currentTimeMs: number, range: PlaybackRange): boolean =>
  range.endMs > range.startMs && currentTimeMs >= range.endMs - END_DETECTION_THRESHOLD_MS;

const getVideoPreparationErrorMessage = (error: unknown): string => {
  if (!(error instanceof Error) || error.message.trim().length === 0) {
    return "Could not prepare this video.";
  }

  const trimPrefix = "Failed to trim video:";
  const message = error.message.startsWith(trimPrefix)
    ? error.message.slice(trimPrefix.length).trim()
    : error.message;

  return `Could not trim this video. ${message}`;
};

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
  const { width: windowWidth } = useWindowDimensions();
  const [trimRange, setTrimRange] = useState<VideoTrimRange>(() => getInitialRange(video?.duration));
  const [trackWidth, setTrackWidth] = useState(0);
  const [progressTrackWidth, setProgressTrackWidth] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [isPlayerLoading, setIsPlayerLoading] = useState(false);
  const [isMediaResolving, setIsMediaResolving] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [dragCurrentTimeMs, setDragCurrentTimeMs] = useState<number | null>(null);
  const [playerDurationMs, setPlayerDurationMs] = useState<number | undefined>(undefined);
  const [areControlsVisible, setAreControlsVisible] = useState(true);
  const [actionsMenuVisible, setActionsMenuVisible] = useState(false);
  const [playbackUri, setPlaybackUri] = useState<string | null>(null);

  const videoSource = useMemo(() => (playbackUri ? { uri: playbackUri } : null), [playbackUri]);
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
  const dragCurrentTimeRef = useRef<number | null>(dragCurrentTimeMs);
  const progressDragStartTimeRef = useRef(0);
  const isProgressDraggingRef = useRef(false);
  const isSeekPendingRef = useRef(false);
  const controlsAutoHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekUnlockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    dragCurrentTimeRef.current = dragCurrentTimeMs;
  }, [dragCurrentTimeMs]);

  const getPlaybackRange = useCallback((): PlaybackRange => {
    const currentDurationMs = durationRef.current ?? 0;

    if (showTrimControls) {
      const currentTrimRange = trimRangeRef.current;

      if (currentTrimRange.endMs > currentTrimRange.startMs) {
        return {
          startMs: currentTrimRange.startMs,
          endMs: currentTrimRange.endMs,
        };
      }
    }

    return {
      startMs: 0,
      endMs: currentDurationMs,
    };
  }, [showTrimControls]);

  const setCurrentPlaybackTime = useCallback((nextTimeMs: number) => {
    currentTimeRef.current = nextTimeMs;
    setCurrentTimeMs(nextTimeMs);
    setDragCurrentTimeMs(null);
  }, []);

  useEffect(() => {
    setTrimRange(getInitialRange(durationMs));
  }, [durationMs, video?.uri]);

  useEffect(() => {
    let isMounted = true;

    if (!visible || !video?.uri) {
      setPlaybackUri(null);
      setIsMediaResolving(false);
      return;
    }

    setPlaybackUri(null);
    setIsMediaResolving(true);
    setIsPlayerLoading(true);

    const resolvePlaybackUri = async () => {
      const cachedUri = await getCachedMediaUriAsync({
        uri: video.uri,
        mediaType: "video",
        mimeType: video.mimeType,
        fileName: video.fileName,
      });

      if (isMounted) {
        setPlaybackUri(cachedUri);
        setIsMediaResolving(false);
      }
    };

    resolvePlaybackUri().catch((error: unknown) => {
      if (__DEV__) {
        console.warn("Failed to resolve video preview cache", error);
      }

      if (isMounted) {
        setPlaybackUri(video.uri);
        setIsMediaResolving(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [video?.fileName, video?.mimeType, video?.uri, visible]);

  useEventListener(player, "playingChange", ({ isPlaying: nextIsPlaying }) => {
    setIsPlaying(nextIsPlaying);
  });

  useEventListener(player, "statusChange", ({ status }) => {
    if (status === "loading") {
      setIsPlayerLoading(true);
      return;
    }

    if (status === "readyToPlay" || status === "error") {
      setIsPlayerLoading(false);
    }
  });

  useEventListener(player, "timeUpdate", ({ currentTime }) => {
    if (isProgressDraggingRef.current) {
      return;
    }

    const nextTimeMs = Math.round(currentTime * MS_PER_SECOND);
    const playbackRange = getPlaybackRange();

    if (showTrimControls && isPlaybackAtRangeEnd(nextTimeMs, playbackRange)) {
      player.pause();
      player.currentTime = playbackRange.startMs / MS_PER_SECOND;
      setIsPlaying(false);
      setAreControlsVisible(true);
      setCurrentPlaybackTime(playbackRange.startMs);
      return;
    }

    setCurrentPlaybackTime(clamp(nextTimeMs, playbackRange.startMs, playbackRange.endMs || nextTimeMs));
  });

  useEventListener(player, "sourceLoad", ({ duration }) => {
    const nextDurationMs = duration > 0 ? Math.round(duration * MS_PER_SECOND) : undefined;
    setPlayerDurationMs(nextDurationMs);
    const initialTimeMs = showTrimControls ? trimRangeRef.current.startMs : 0;
    setCurrentPlaybackTime(initialTimeMs);
    setIsPlayerLoading(false);

    if (visible && autoPlay) {
      player.currentTime = initialTimeMs / MS_PER_SECOND;
      player.play();
      setIsPlaying(true);
    }
  });

  useEventListener(player, "playToEnd", () => {
    const playbackRange = getPlaybackRange();
    setIsPlaying(false);
    setAreControlsVisible(true);

    if (playbackRange.endMs > playbackRange.startMs) {
      setCurrentPlaybackTime(showTrimControls ? playbackRange.startMs : playbackRange.endMs);
    }
  });

  useEffect(() => {
    if (!visible) {
      player.pause();
      setIsSending(false);
      setIsPlaying(false);
      setDragCurrentTimeMs(null);
      setActionsMenuVisible(false);
      return;
    }

    if (playbackUri) {
      setIsPlayerLoading(true);
      setPlayerDurationMs(undefined);
      setCurrentPlaybackTime(showTrimControls ? trimRangeRef.current.startMs : 0);
      setAreControlsVisible(true);

      if (autoPlay) {
        player.currentTime = (showTrimControls ? trimRangeRef.current.startMs : 0) / MS_PER_SECOND;
        player.play();
        setIsPlaying(true);
      } else {
        player.pause();
        setIsPlaying(false);
      }
    }
  }, [autoPlay, playbackUri, player, setCurrentPlaybackTime, showTrimControls, visible]);

  const clearControlsAutoHideTimeout = useCallback(() => {
    if (controlsAutoHideTimeoutRef.current) {
      clearTimeout(controlsAutoHideTimeoutRef.current);
      controlsAutoHideTimeoutRef.current = null;
    }
  }, []);

  const scheduleControlsAutoHide = useCallback(() => {
    clearControlsAutoHideTimeout();

    if (!isPlaying || isPlayerLoading || isMediaResolving) {
      return;
    }

    controlsAutoHideTimeoutRef.current = setTimeout(() => {
      setAreControlsVisible(false);
    }, CONTROLS_AUTO_HIDE_DELAY_MS);
  }, [clearControlsAutoHideTimeout, isMediaResolving, isPlayerLoading, isPlaying]);

  useEffect(() => {
    if (areControlsVisible && isPlaying && !isPlayerLoading && !isMediaResolving) {
      scheduleControlsAutoHide();
      return;
    }

    clearControlsAutoHideTimeout();
  }, [areControlsVisible, clearControlsAutoHideTimeout, isMediaResolving, isPlayerLoading, isPlaying, scheduleControlsAutoHide]);

  useEffect(() => clearControlsAutoHideTimeout, [clearControlsAutoHideTimeout]);

  useEffect(() => {
    return () => {
      if (seekUnlockTimeoutRef.current) {
        clearTimeout(seekUnlockTimeoutRef.current);
      }
    };
  }, []);

  const seekToMs = useCallback(
    (milliseconds: number, force: boolean = false) => {
      if (isSeekPendingRef.current && !force) {
        return;
      }

      const playbackRange = getPlaybackRange();
      const fallbackEndMs = playbackRange.endMs > playbackRange.startMs
        ? playbackRange.endMs
        : Math.max(playbackRange.startMs, milliseconds);
      const nextTimeMs = clamp(milliseconds, playbackRange.startMs, fallbackEndMs);
      isSeekPendingRef.current = true;
      player.currentTime = nextTimeMs / MS_PER_SECOND;
      setCurrentPlaybackTime(nextTimeMs);
      setAreControlsVisible(true);

      if (seekUnlockTimeoutRef.current) {
        clearTimeout(seekUnlockTimeoutRef.current);
      }

      seekUnlockTimeoutRef.current = setTimeout(() => {
        isSeekPendingRef.current = false;
        seekUnlockTimeoutRef.current = null;
      }, SEEK_LOCK_RELEASE_DELAY_MS);
    },
    [getPlaybackRange, player, setCurrentPlaybackTime],
  );

  const togglePlayback = useCallback(() => {
    const playbackRange = getPlaybackRange();
    const videoEnded = isPlaybackAtRangeEnd(currentTimeRef.current, playbackRange);
    const shouldPause = !videoEnded && (isPlaying || player.playing);

    if (shouldPause) {
      player.pause();
      setIsPlaying(false);
      setAreControlsVisible(true);
      return;
    }

    const isCurrentTimeOutsideRange =
      currentTimeRef.current < playbackRange.startMs || currentTimeRef.current >= playbackRange.endMs;

    if (videoEnded || isCurrentTimeOutsideRange) {
      player.currentTime = playbackRange.startMs / MS_PER_SECOND;
      setCurrentPlaybackTime(playbackRange.startMs);
    }

    player.play();
    setIsPlaying(true);
    setAreControlsVisible(true);
  }, [getPlaybackRange, isPlaying, player, setCurrentPlaybackTime]);

  const seekBySeconds = useCallback(
    (seconds: number) => {
      seekToMs(currentTimeRef.current + seconds * MS_PER_SECOND);
    },
    [seekToMs],
  );

  const handlePlayerTap = useCallback(() => {
    if (isPlayerLoading || isMediaResolving || !playbackUri) {
      return;
    }

    if (!areControlsVisible) {
      setAreControlsVisible(true);
      return;
    }

    if (isPlaying) {
      setAreControlsVisible(false);
    }
  }, [areControlsVisible, isMediaResolving, isPlayerLoading, isPlaying, playbackUri]);

  const handleProgressTrackLayout = useCallback((event: LayoutChangeEvent) => {
    setProgressTrackWidth(event.nativeEvent.layout.width);
  }, []);

  const getProgressTimeFromLocation = useCallback((locationX: number): number | null => {
    const playbackRange = getPlaybackRange();
    const rangeDurationMs = playbackRange.endMs - playbackRange.startMs;
    const currentProgressTrackWidth = progressTrackWidthRef.current;

    if (rangeDurationMs <= 0 || currentProgressTrackWidth <= 0) {
      return null;
    }

    const nextProgress = clamp(locationX / currentProgressTrackWidth, 0, 1);

    return playbackRange.startMs + nextProgress * rangeDurationMs;
  }, [getPlaybackRange]);

  const updateProgressDrag = useCallback((nextTimeMs: number) => {
    dragCurrentTimeRef.current = nextTimeMs;
    setDragCurrentTimeMs(nextTimeMs);
    setAreControlsVisible(true);
  }, []);

  const commitProgressDrag = useCallback(() => {
    const nextTimeMs = dragCurrentTimeRef.current;
    isProgressDraggingRef.current = false;
    dragCurrentTimeRef.current = null;
    setDragCurrentTimeMs(null);

    if (nextTimeMs !== null) {
      seekToMs(nextTimeMs);
    }
  }, [seekToMs]);

  const progressPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          const nextTimeMs = getProgressTimeFromLocation(event.nativeEvent.locationX);

          if (nextTimeMs === null) {
            return;
          }

          clearControlsAutoHideTimeout();
          isProgressDraggingRef.current = true;
          progressDragStartTimeRef.current = nextTimeMs;
          updateProgressDrag(nextTimeMs);
        },
        onPanResponderMove: (_event, gestureState) => {
          const playbackRange = getPlaybackRange();
          const rangeDurationMs = playbackRange.endMs - playbackRange.startMs;
          const currentProgressTrackWidth = progressTrackWidthRef.current;

          if (rangeDurationMs <= 0 || currentProgressTrackWidth <= 0) {
            return;
          }

          const deltaMs = (gestureState.dx / currentProgressTrackWidth) * rangeDurationMs;
          const nextTimeMs = clamp(
            progressDragStartTimeRef.current + deltaMs,
            playbackRange.startMs,
            playbackRange.endMs,
          );
          updateProgressDrag(nextTimeMs);
        },
        onPanResponderRelease: commitProgressDrag,
        onPanResponderTerminate: commitProgressDrag,
      }),
    [
      clearControlsAutoHideTimeout,
      commitProgressDrag,
      getPlaybackRange,
      getProgressTimeFromLocation,
      updateProgressDrag,
    ],
  );

  const handleFirstFrameRender = useCallback(() => {
    setIsPlayerLoading(false);
    setAreControlsVisible(true);

    const nextDurationMs = player.duration > 0 ? Math.round(player.duration * MS_PER_SECOND) : undefined;

    if (player.duration > 0) {
      setPlayerDurationMs(nextDurationMs);
    }

    const playbackRange = getPlaybackRange();
    const fallbackEndMs = playbackRange.endMs > playbackRange.startMs
      ? playbackRange.endMs
      : durationRef.current ?? nextDurationMs ?? 0;
    const nextCurrentTimeMs = clamp(
      Math.round(player.currentTime * MS_PER_SECOND),
      playbackRange.startMs,
      fallbackEndMs,
    );
    setCurrentPlaybackTime(nextCurrentTimeMs);

    if (autoPlay && visible && !player.playing) {
      player.play();
      setIsPlaying(true);
    }
  }, [autoPlay, getPlaybackRange, player, setCurrentPlaybackTime, visible]);

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

      trimRangeRef.current = nextRange;
      setTrimRange(nextRange);
    },
    [],
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

      trimRangeRef.current = nextRange;
      setTrimRange(nextRange);
    },
    [],
  );

  const beginTrimDrag = useCallback(() => {
    clearControlsAutoHideTimeout();
    dragStartRangeRef.current = trimRangeRef.current;

    if (player.playing) {
      player.pause();
      setIsPlaying(false);
    }

    setAreControlsVisible(true);
  }, [clearControlsAutoHideTimeout, player]);

  const clampPreviewToTrimRange = useCallback(() => {
    const playbackRange = getPlaybackRange();
    const currentTime = currentTimeRef.current;

    if (currentTime < playbackRange.startMs || isPlaybackAtRangeEnd(currentTime, playbackRange)) {
      seekToMs(playbackRange.startMs, true);
    }
  }, [getPlaybackRange, seekToMs]);

  const commitStartTrimDrag = useCallback(() => {
    clampPreviewToTrimRange();
  }, [clampPreviewToTrimRange]);

  const commitEndTrimDrag = useCallback(() => {
    clampPreviewToTrimRange();
  }, [clampPreviewToTrimRange]);

  const leftHandlePanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: beginTrimDrag,
        onPanResponderMove: (_event, gestureState) => {
          updateStartHandle(gestureState.dx);
        },
        onPanResponderRelease: commitStartTrimDrag,
        onPanResponderTerminate: commitStartTrimDrag,
      }),
    [beginTrimDrag, commitStartTrimDrag, updateStartHandle],
  );

  const rightHandlePanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: beginTrimDrag,
        onPanResponderMove: (_event, gestureState) => {
          updateEndHandle(gestureState.dx);
        },
        onPanResponderRelease: commitEndTrimDrag,
        onPanResponderTerminate: commitEndTrimDrag,
      }),
    [beginTrimDrag, commitEndTrimDrag, updateEndHandle],
  );

  const handleTrackLayout = (event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  };

  const trimChanged = hasVideoTrimChanged(trimRange, durationMs);
  const canShowSendButton = Boolean((showSendButton ?? Boolean(onSend)) && onSend);
  const canShowActionsMenu = showActionsMenu && hasPreviewActions(actions);
  const isDownloadInProgress = Boolean(actions?.isDownloadInProgress);
  const downloadStatusText = actions?.downloadStatusText ?? "Saving video...";
  const hasBottomPanel = showTrimControls || canShowSendButton;
  const isGalleryPreviewMode = showTrimControls;
  const isVideoLoading = isPlayerLoading || isMediaResolving || !playbackUri;
  const canRenderTrimControls = showTrimControls && Boolean(durationMs && durationMs > MIN_TRIM_DURATION_MS);
  const selectedLeft = durationMs && trackWidth > 0 ? (trimRange.startMs / durationMs) * trackWidth : 0;
  const selectedWidth =
    durationMs && trackWidth > 0
      ? ((trimRange.endMs - trimRange.startMs) / durationMs) * trackWidth
      : 0;
  const currentDurationMs = durationMs ?? 0;
  const displayPlaybackRange: PlaybackRange = showTrimControls
    ? trimRange
    : { startMs: 0, endMs: currentDurationMs };
  const displayPlaybackDurationMs = Math.max(
    0,
    displayPlaybackRange.endMs - displayPlaybackRange.startMs,
  );
  const displayCurrentTimeMs = dragCurrentTimeMs ?? currentTimeMs;
  const clampedCurrentTimeMs = clamp(
    displayCurrentTimeMs,
    displayPlaybackRange.startMs,
    displayPlaybackRange.endMs || currentDurationMs,
  );
  const progress =
    displayPlaybackDurationMs > 0
      ? (clampedCurrentTimeMs - displayPlaybackRange.startMs) / displayPlaybackDurationMs
      : 0;
  const progressFillWidth = progressTrackWidth * progress;
  const progressThumbLeft = clamp(
    progressFillWidth - PROGRESS_THUMB_SIZE / 2,
    0,
    Math.max(0, progressTrackWidth - PROGRESS_THUMB_SIZE),
  );
  const selectedDurationMs = Math.max(0, trimRange.endMs - trimRange.startMs);
  const headerReservedHeight = isGalleryPreviewMode ? GALLERY_HEADER_RESERVED_HEIGHT : HEADER_RESERVED_HEIGHT;
  const bottomPanelReservedHeight = isGalleryPreviewMode
    ? GALLERY_BOTTOM_PANEL_RESERVED_HEIGHT
    : BOTTOM_PANEL_RESERVED_HEIGHT;
  const playerPaddingBottom = hasBottomPanel
    ? bottomPanelReservedHeight + Math.max(insets.bottom, 16)
    : CHAT_PLAYER_BOTTOM_PADDING + Math.max(insets.bottom, 16);
  const playerHorizontalPadding = isGalleryPreviewMode
    ? GALLERY_PLAYER_HORIZONTAL_PADDING
    : CHAT_PLAYER_HORIZONTAL_PADDING;
  const galleryPlayerSurfaceWidth = windowWidth * GALLERY_PLAYER_SURFACE_WIDTH_RATIO;
  const actionsMenuTop = Math.max(insets.top, 20) + 44;
  const canShowPlayerControls = areControlsVisible && !isVideoLoading;

  const handleSend = async () => {
    if (!video || !onSend || isSending) {
      return;
    }

    let didStartSend = false;

    try {
      setIsSending(true);

      let videoToSend = video;

      if (trimChanged) {
        const trimmedVideo = await trimVideoAsync({
          uri: playbackUri ?? video.uri,
          fileName: video.fileName ?? "video.mp4",
          mimeType: video.mimeType ?? "video/mp4",
          startMs: trimRange.startMs,
          endMs: trimRange.endMs,
          durationMs,
        });

        videoToSend = {
          ...video,
          uri: trimmedVideo.uri,
          fileName: trimmedVideo.fileName,
          mimeType: trimmedVideo.mimeType,
          duration: trimRange.endMs - trimRange.startMs,
        };
      }

      didStartSend = true;
      await onSend(videoToSend);
    } catch (error) {
      console.error("Failed to send video", error);
      if (!didStartSend) {
        Alert.alert("Video Error", getVideoPreparationErrorMessage(error));
      }
    } finally {
      setIsSending(false);
    }
  };

  const titleText = video?.fileName || title;
  const disableSend = isSending || !video?.uri || (trimChanged && !playbackUri);

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
            isGalleryPreviewMode ? styles.galleryPlayerContainer : styles.chatPlayerContainer,
            {
              paddingTop: headerReservedHeight + Math.max(insets.top, 0),
              paddingBottom: playerPaddingBottom,
              paddingHorizontal: playerHorizontalPadding,
            },
          ]}
        >
          <View
            style={[
              styles.playerSurface,
              isGalleryPreviewMode
                ? [styles.galleryPlayerSurface, { width: galleryPlayerSurfaceWidth }]
                : styles.chatPlayerSurface,
            ]}
          >
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

            {canShowPlayerControls ? (
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
                    {formatTime(clampedCurrentTimeMs)} / {formatTime(displayPlaybackRange.endMs || currentDurationMs)}
                  </Text>
                  <View
                    style={styles.progressTrackPressable}
                    onLayout={handleProgressTrackLayout}
                    {...progressPanResponder.panHandlers}
                  >
                    <View style={styles.progressTrackBase} />
                    <View style={[styles.progressTrackFill, { width: progressFillWidth }]} />
                    <View style={[styles.progressThumb, { left: progressThumbLeft }]} />
                  </View>
                </View>
              </View>
            ) : null}
          </View>

          {isVideoLoading && (
            <View style={styles.playerLoadingOverlay} pointerEvents="none">
              <ActivityIndicator size="large" color={Colors.white} />
            </View>
          )}
        </View>

        {hasBottomPanel ? (
          <View style={[styles.bottomControls, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            {showTrimControls ? (
              <View style={styles.trimContainer}>
                {canRenderTrimControls ? (
                  <>
                    <View style={styles.timelineRow}>
                      <Text style={styles.timelineEdgeText}>{formatTime(trimRange.startMs)}</Text>
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
                      <Text style={styles.timelineEdgeText}>{formatTime(trimRange.endMs)}</Text>
                    </View>
                    <Text style={styles.selectedDurationText}>
                      Selected: {formatTime(selectedDurationMs)}
                    </Text>
                  </>
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
                  <>
                    <ActivityIndicator size="small" color={Colors.white} />
                    <Text style={styles.sendButtonText}>{PREPARING_VIDEO_LABEL}</Text>
                  </>
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

        {isDownloadInProgress ? (
          <View style={styles.downloadOverlay} pointerEvents="none">
            <ActivityIndicator size="small" color={Colors.white} />
            <Text style={styles.downloadOverlayText}>{downloadStatusText}</Text>
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
  },
  chatPlayerContainer: {
    width: "100%",
  },
  galleryPlayerContainer: {
    width: "100%",
  },
  playerSurface: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
  },
  chatPlayerSurface: {
    width: "100%",
  },
  galleryPlayerSurface: {
    alignSelf: "center",
    maxWidth: "100%",
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
    width: PROGRESS_THUMB_SIZE,
    height: PROGRESS_THUMB_SIZE,
    borderRadius: PROGRESS_THUMB_SIZE / 2,
    backgroundColor: Colors.white,
  },
  playerLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  downloadOverlay: {
    position: "absolute",
    alignSelf: "center",
    bottom: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.72)",
  },
  downloadOverlayText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: "600",
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
    gap: 8,
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
  selectedDurationText: {
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
