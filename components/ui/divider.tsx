import { StyleSheet, Text, View } from "react-native";

import { Colors, FontSizes, Spacing } from "@/constants/theme";

interface DividerProps {
  text?: string;
}

export function Divider({ text = "or" }: DividerProps) {
  return (
    <View style={styles.container}>
      <View style={styles.line} />
      <Text style={styles.text}>{text}</Text>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: Spacing.lg,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  text: {
    marginHorizontal: Spacing.md,
    fontSize: FontSizes.sm,
    color: Colors.textMuted,
    fontWeight: "500",
  },
});
