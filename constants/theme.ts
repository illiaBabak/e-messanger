/**
 * Центральное хранилище всех визуальных констант приложения.
 * Импортируй { Colors, Spacing, FontSizes, BorderRadius } из '@/constants/theme'
 * и используй вместо «магических чисел» в StyleSheet.
 */

import { Platform } from 'react-native';

// ─── Цвета ───────────────────────────────────────────────
export const Colors = {
  // Основной синий — используется для splash-экрана и акцентов
  primary: '#4A90FF',
  primaryDark: '#3A7BE0',

  // Фоны
  background: '#F8F9FB',
  white: '#FFFFFF',
  black: '#000000',

  // Текст
  textPrimary: '#1A1A2E',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',

  // Границы и разделители
  border: '#E5E7EB',
  borderLight: '#F3F4F6',

  // Социальные кнопки
  google: '#FFFFFF',
  apple: '#000000',

  // Статусы
  error: '#EF4444',
  success: '#22C55E',

  // Утилитарные
  overlay: 'rgba(0, 0, 0, 0.3)',
  transparent: 'transparent',
};

// ─── Отступы ─────────────────────────────────────────────
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// ─── Размеры шрифтов ────────────────────────────────────
export const FontSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 28,
  xxl: 36,
  logo: 42,
} as const;

// ─── Скругления ──────────────────────────────────────────
export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

// ─── Шрифты (системные, платформо-зависимые) ─────────────
export const Fonts = Platform.select({
  ios: {
    sans: 'System',
    semibold: 'System',
    bold: 'System',
    mono: 'Menlo',
  },
  default: {
    sans: 'normal',
    semibold: 'normal',
    bold: 'normal',
    mono: 'monospace',
  },
})!;
