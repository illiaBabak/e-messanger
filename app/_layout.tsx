import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/providers/AuthProvider';

export default function RootLayout() {
  return (
    <AuthProvider>
      <SafeAreaProvider>
        <StatusBar style="light" />

        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'fade',
          }}
        >
          <Stack.Screen name="index" />
          
          <Stack.Screen
            name="auth"
            options={{ gestureEnabled: false }}
          />
          
          <Stack.Screen 
            name="main" 
            options={{ gestureEnabled: false }} 
          />
          
          <Stack.Screen 
            name="chat" 
            options={{ 
              headerShown: false,
              animation: 'default'
            }} 
          />
        </Stack>
      </SafeAreaProvider>
    </AuthProvider>
  );
}
