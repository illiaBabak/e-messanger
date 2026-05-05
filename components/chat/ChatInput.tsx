import { Colors } from "@/constants/theme";
import { Message } from "@/hooks/useMessages";
import { Ionicons } from "@expo/vector-icons";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import React, { useEffect, useRef, useState } from "react";
import { Alert, Animated, PanResponder, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { AttachmentModal } from "./AttachmentModal";

type AudioInfo = { uri: string; duration: number; waveform: number[] };

type ChatInputProps = {
  messageText: string;
  setMessageText: (text: string) => void;
  onSendText: () => void;
  onSendAudio: (info: AudioInfo) => void;
  onSendMedia?: (uris: string[]) => void;
  replyingToMessage: Message | null;
  editingMessage: Message | null;
  onCancelReplyOrEdit: () => void;
  name: string;
  currentUserId?: string;
  textInputRef: React.RefObject<TextInput | null>;
};

export const ChatInput = ({
  messageText,
  setMessageText,
  onSendText,
  onSendAudio,
  replyingToMessage,
  editingMessage,
  onCancelReplyOrEdit,
  name,
  currentUserId,
  textInputRef,
  onSendMedia,
}: ChatInputProps) => {
  const [isAttachmentModalVisible, setIsAttachmentModalVisible] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const state = useAudioRecorderState(recorder, 100);
  
  const [meteringData, setMeteringData] = useState<number[]>([]);
  const meteringDataRef = useRef<number[]>([]);
  const durationRef = useRef<number>(0);
  const isCanceled = useRef(false);

  useEffect(() => {
    durationRef.current = state.durationMillis;
  }, [state.durationMillis]);

  const startRecording = async () => {
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) {
      Alert.alert("Permission required", "Microphone permission is required to record voice messages.");
      return;
    }
    try {
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      setIsRecording(true);
      isCanceled.current = false;
      setMeteringData([]);
      meteringDataRef.current = [];
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (e) {
      console.error("Failed to start recording", e);
      setIsRecording(false);
    }
  };

  const cancelRecording = async () => {
    isCanceled.current = true;
    if (recorder.getStatus().isRecording) {
      recorder.stop();
    }
    setIsRecording(false);
    
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
    }).catch(console.error);
  };

  const finishRecording = async () => {
    if (isCanceled.current) return;
    const duration = durationRef.current;
    if (recorder.getStatus().isRecording) {
      recorder.stop();
    }
    setIsRecording(false);
    
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
    }).catch(console.error);
    
    if (duration < 500) {
      return; // Too short, ignore
    }

    const uri = recorder.uri;
    if (uri) {
      onSendAudio({ uri, duration, waveform: meteringDataRef.current });
    }
  };

  useEffect(() => {
    if (state.isRecording && state.metering !== undefined) {
      setMeteringData(prev => {
        const next = [...prev, state.metering!];
        const finalData = next.length > 50 ? next.slice(next.length - 50) : next;
        meteringDataRef.current = finalData;
        return finalData;
      });
    }
  }, [state.metering, state.isRecording]);

  const pan = useRef(new Animated.ValueXY()).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !messageText.trim(),
      onMoveShouldSetPanResponder: () => !messageText.trim(),
      onPanResponderGrant: () => {
        startRecording();
      },
      onPanResponderMove: (e, gestureState) => {
        if (gestureState.dx < 0) {
          Animated.event([null, { dx: pan.x }], { useNativeDriver: false })(e, gestureState);
        }
      },
      onPanResponderRelease: (e, gestureState) => {
        if (gestureState.dx < -100) {
          cancelRecording();
        } else {
          finishRecording();
        }
        Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
      },
      onPanResponderTerminate: () => {
        cancelRecording();
        Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
      }
    })
  ).current;

  // Format time (e.g. "0:05")
  const formatTime = (millis: number) => {
    const totalSeconds = Math.floor(millis / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <View style={styles.container}>
      {isRecording ? (
        <View style={styles.recordingContainer}>
          <Animated.View style={[styles.slideCancelContainer, { opacity: pan.x.interpolate({ inputRange: [-100, 0], outputRange: [0, 1], extrapolate: 'clamp' }) }]}>
            <Ionicons name="trash-outline" size={24} color={Colors.error} />
          </Animated.View>

          <View style={styles.waveContainer}>
            {meteringData.map((val, index) => {
              const normalized = Math.max(0, val + 60) / 60; 
              const barHeight = Math.max(3, normalized * 30);
              return (
                <View
                  key={index}
                  style={[styles.waveBar, { height: barHeight }]}
                />
              );
            })}
          </View>
          <Text style={styles.durationText}>{formatTime(state.durationMillis)}</Text>
        </View>
      ) : (
        <>
          <Pressable 
            style={[styles.floatingCircle, {backgroundColor: Colors.background}]}
            onPress={() => setIsAttachmentModalVisible(true)}
          >
            <Ionicons name="attach" size={24} color={Colors.textSecondary} />
          </Pressable>

          <View style={styles.inputAreaWrapper}>
            {(replyingToMessage || editingMessage) && (
              <View style={styles.replyPreviewContainer}>
                <View style={styles.replyPreviewLine} />
                <View style={styles.replyPreviewContent}>
                  <Text style={styles.replyPreviewName}>
                    {editingMessage ? "Edit Message" : (replyingToMessage?.senderId === currentUserId ? "You" : name)}
                  </Text>
                  <Text style={styles.replyPreviewText} numberOfLines={1}>
                    {editingMessage ? editingMessage.text : (replyingToMessage?.audio ? "🎤 Voice message" : replyingToMessage?.text)}
                  </Text>
                </View>
                <Pressable onPress={onCancelReplyOrEdit} style={styles.replyPreviewClose}>
                  <Ionicons name="close-circle" size={20} color={Colors.textMuted} />
                </Pressable>
              </View>
            )}
            <View style={styles.floatingInputWrapper}>
              <TextInput
                ref={textInputRef}
                style={styles.textInput}
                placeholder="Message"
                placeholderTextColor={Colors.textMuted}
                value={messageText}
                onChangeText={setMessageText}
                multiline
              />
            </View>
          </View>
        </>
      )}

      {messageText.trim() ? (
        <Pressable 
          style={styles.floatingCirclePrimary} 
          onPress={onSendText}
        >
          <Ionicons name="arrow-up" size={24} color={Colors.white} />
        </Pressable>
      ) : (
        <Animated.View 
          style={[styles.floatingCirclePrimary, { transform: [{ translateX: pan.x }] }]}
          {...panResponder.panHandlers}
        >
          <Ionicons
            name="mic-outline"
            size={24}
            color={Colors.white}
          />
        </Animated.View>
      )}

      <AttachmentModal
        visible={isAttachmentModalVisible}
        onClose={() => setIsAttachmentModalVisible(false)}
        contactName={name}
        onSendMedia={(uris) => {
          if (onSendMedia) {
            onSendMedia(uris);
          }
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingTop: 8,
    minHeight: 48,
  },
  floatingCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  floatingCirclePrimary: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    marginLeft: 8,
    zIndex: 10,
  },
  inputAreaWrapper: {
    flex: 1,
    flexDirection: "column",
    justifyContent: "center",
    backgroundColor: Colors.white,
    borderRadius: 20,
    paddingHorizontal: 12,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 40,
  },
  floatingInputWrapper: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingVertical: 4,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.textPrimary,
    maxHeight: 100,
    minHeight: 32,
    paddingTop: 8,
    paddingBottom: 8,
  },
  replyPreviewContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: 4,
  },
  replyPreviewLine: {
    width: 3,
    height: "100%",
    backgroundColor: Colors.primary,
    borderRadius: 2,
    marginRight: 8,
  },
  replyPreviewContent: {
    flex: 1,
  },
  replyPreviewName: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.primary,
    marginBottom: 2,
  },
  replyPreviewText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  replyPreviewClose: {
    padding: 4,
  },
  recordingContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderRadius: 24,
    height: 48,
    paddingHorizontal: 4,
    justifyContent: "space-between",
    marginLeft: 8,
  },
  slideCancelContainer: {
    flexDirection: "row",
    alignItems: "center",
    position: "absolute",
    left: 16,
    zIndex: 1,
  },
  waveContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingRight: 16,
    height: 40,
    gap: 2,
    zIndex: 2,
  },
  waveBar: {
    width: 3,
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  durationText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: "bold",
    marginRight: 16,
    zIndex: 2,
  },
});
