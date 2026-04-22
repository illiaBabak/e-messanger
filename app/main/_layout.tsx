import { Colors } from '@/constants/theme';
import { useAuth } from '@/providers/AuthProvider';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';

export default function MainLayout() {
  const { user, isProfileComplete, isLoading } = useAuth();

  if (isLoading) return null; 

  if (!user) return <Redirect href="/auth" />;

  if (!isProfileComplete) return <Redirect href="/auth/create-profile" />;

  return (
    <Tabs 
      screenOptions={{ 
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: Colors.border,
        }
      }}
    >
      <Tabs.Screen 
        name="contacts" 
        options={{
          title: "Contacts",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          )
        }} 
      />
      <Tabs.Screen 
        name="index" 
        options={{
          title: "Chats",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles-outline" size={size} color={color} />
          )
        }} 
      />
      <Tabs.Screen 
        name="settings" 
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          )
        }} 
      />
    </Tabs>
  );
}
