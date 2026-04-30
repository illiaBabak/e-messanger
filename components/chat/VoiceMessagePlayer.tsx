import React, { useEffect } from "react";
import { View, Text, Pressable, StyleSheet, DeviceEventEmitter } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { Colors } from "@/constants/theme";

export const VoiceMessagePlayer = ({
  messageId,
  url,
  duration,
  waveform,
  isOwnMessage,
}: {
  messageId: string;
  url: string;
  duration: number;
  waveform?: number[];
  isOwnMessage: boolean;
}) => {
  const player = useAudioPlayer(url, { updateInterval: 50, downloadFirst: false });
  const status = useAudioPlayerStatus(player);
  
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('onPlayVoiceMessage', (playingId) => {
      if (playingId !== messageId && status.playing) {
        player.pause();
      }
    });
    return () => subscription.remove();
  }, [messageId, status.playing, player]);

  const currentMillis = status.currentTime * 1000 || 0;
  const progress = duration > 0 ? Math.min(currentMillis / duration, 1) : 0;

  const handlePlayPause = () => {
    if (status.playing) {
      player.pause();
    } else {
      // If we've reached the end of the audio, restart it
      if (currentMillis >= duration - 50) {
        player.seekTo(0);
      }
      DeviceEventEmitter.emit('onPlayVoiceMessage', messageId);
      player.play();
    }
  };

  // Format time (e.g. "0:05")
  const formatTime = (millis: number) => {
    const totalSeconds = Math.floor(millis / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const activeColor = isOwnMessage ? Colors.white : Colors.primary;
  const inactiveColor = isOwnMessage ? "rgba(255,255,255,0.4)" : "rgba(74,144,226,0.3)";

  return (
    <View style={styles.container}>
      <Pressable onPress={handlePlayPause} style={styles.playButton}>
        <Ionicons name={status.playing ? "pause" : "play"} size={26} color={activeColor} />
      </Pressable>
      
      <View style={styles.waveformContainer}>
        {waveform && waveform.length > 0 ? (
          waveform.map((val, index) => {
            const barProgress = index / waveform.length;
            const isPlayed = barProgress <= progress;
            // Map metering (-60 to 0) to height (2 to 24)
            const normalized = Math.max(0, val + 60) / 60; 
            const barHeight = Math.max(3, normalized * 32);

            return (
              <View
                key={index}
                style={[
                  styles.waveBar,
                  { 
                    height: barHeight,
                    backgroundColor: isPlayed ? activeColor : inactiveColor
                  }
                ]}
              />
            );
          })
        ) : (
          <View style={styles.fallbackBar}>
            <View style={[styles.fallbackProgress, { width: `${progress * 100}%`, backgroundColor: activeColor }]} />
          </View>
        )}
      </View>
      <Text style={[styles.duration, { color: activeColor }]}>
        {formatTime(status.playing ? currentMillis : duration)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 4,
    minWidth: 200,
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  waveformContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 8,
    height: 38,
    gap: 2,
  },
  waveBar: {
    flex: 1,
    borderRadius: 2,
  },
  fallbackBar: {
    flex: 1,
    height: 4,
    backgroundColor: "rgba(0,0,0,0.1)",
    borderRadius: 2,
    overflow: "hidden",
  },
  fallbackProgress: {
    height: "100%",
  },
  duration: {
    fontSize: 12,
    minWidth: 32,
    textAlign: "right",
  }
});
