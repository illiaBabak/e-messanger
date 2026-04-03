import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />

      <Stack
        screenOptions={{
          headerShown: false,
          animation: "fade",
        }}
      >
        <Stack.Screen name="index" />

        <Stack.Screen
          name="auth"
          options={{
            gestureEnabled: false,
          }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
