import { useAuth } from '@/providers/AuthProvider';
import { Redirect, Stack } from 'expo-router';

export default function AppLayout() {
  const { user, isProfileComplete, isLoading } = useAuth();

  if (isLoading) return null; 

  if (!user) return <Redirect href="/auth" />;

  if (!isProfileComplete) return <Redirect href="/auth/create-profile" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
