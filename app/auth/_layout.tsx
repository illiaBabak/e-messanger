/**
 * Файл: app/auth/_layout.tsx
 *
 * Layout для группы auth-экранов.
 * Expo Router ТРЕБУЕТ _layout.tsx в каждой папке, где есть экраны.
 *
 * Экраны:
 * - index    → логин (кнопки Google, Apple, телефон)
 * - register → регистрация (форма с полями + соцсети)
 *
 * animation: 'slide_from_right' — новый экран заезжает справа (стандартный
 * iOS-паттерн для push-навигации внутри auth-группы).
 */

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
      <Stack.Screen name="register" />
    </Stack>
  );
}
