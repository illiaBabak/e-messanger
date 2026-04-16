import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="phone" />
      <Stack.Screen name="verify-otp" />
      <Stack.Screen name="create-profile" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
