import React, { ReactNode } from "react";
import { Animated, StyleProp, StyleSheet, View, ViewStyle } from "react-native";

import { Colors } from "@/constants/theme";

export const MEDIA_CARD_BORDER_RADIUS = 16;
export const MEDIA_CARD_TAIL_RADIUS = 4;

const MEDIA_HIGHLIGHT_BORDER_WIDTH = 2;
const MEDIA_HIGHLIGHT_RADIUS = MEDIA_CARD_BORDER_RADIUS + MEDIA_HIGHLIGHT_BORDER_WIDTH;
const MEDIA_HIGHLIGHT_TAIL_RADIUS = MEDIA_CARD_TAIL_RADIUS + MEDIA_HIGHLIGHT_BORDER_WIDTH;
const MEDIA_HIGHLIGHT_SHADOW_RADIUS = 8;
const MEDIA_HIGHLIGHT_SHADOW_OPACITY = 0.18;
const MEDIA_HIGHLIGHT_SHADOW_ELEVATION = 3;
const MEDIA_HIGHLIGHT_BACKGROUND = "rgba(124,185,232,0.1)";

type MediaHighlightFrameProps = {
  children: ReactNode;
  highlightOpacity?: Animated.Value;
  isMe: boolean;
  style: StyleProp<ViewStyle>;
  clipStyle?: StyleProp<ViewStyle>;
};

export const MediaHighlightFrame = ({
  children,
  highlightOpacity,
  isMe,
  style,
  clipStyle,
}: MediaHighlightFrameProps) => {
  return (
    <View style={[styles.mediaHighlightOuter, style]}>
      {highlightOpacity ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.mediaHighlight,
            isMe ? styles.mediaHighlightMe : styles.mediaHighlightFriend,
            { opacity: highlightOpacity },
          ]}
        />
      ) : null}

      <View style={[styles.mediaClip, isMe ? styles.mediaClipMe : styles.mediaClipFriend, clipStyle]}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  mediaHighlightOuter: {
    position: "relative",
    borderRadius: MEDIA_CARD_BORDER_RADIUS,
  },
  mediaHighlight: {
    ...StyleSheet.absoluteFillObject,
    top: -MEDIA_HIGHLIGHT_BORDER_WIDTH,
    right: -MEDIA_HIGHLIGHT_BORDER_WIDTH,
    bottom: -MEDIA_HIGHLIGHT_BORDER_WIDTH,
    left: -MEDIA_HIGHLIGHT_BORDER_WIDTH,
    borderRadius: MEDIA_HIGHLIGHT_RADIUS,
    borderWidth: MEDIA_HIGHLIGHT_BORDER_WIDTH,
    borderColor: Colors.primary,
    backgroundColor: MEDIA_HIGHLIGHT_BACKGROUND,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: MEDIA_HIGHLIGHT_SHADOW_OPACITY,
    shadowRadius: MEDIA_HIGHLIGHT_SHADOW_RADIUS,
    elevation: MEDIA_HIGHLIGHT_SHADOW_ELEVATION,
  },
  mediaHighlightMe: {
    borderBottomRightRadius: MEDIA_HIGHLIGHT_TAIL_RADIUS,
  },
  mediaHighlightFriend: {
    borderBottomLeftRadius: MEDIA_HIGHLIGHT_TAIL_RADIUS,
  },
  mediaClip: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: MEDIA_CARD_BORDER_RADIUS,
    overflow: "hidden",
  },
  mediaClipMe: {
    borderBottomRightRadius: MEDIA_CARD_TAIL_RADIUS,
  },
  mediaClipFriend: {
    borderBottomLeftRadius: MEDIA_CARD_TAIL_RADIUS,
  },
});
