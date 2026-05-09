import { Platform } from 'react-native';

export const Colors = {
  primary: '#4A90FF',
  primaryDark: '#3A7BE0',

  background: '#F8F9FB',
  white: '#FFFFFF',
  black: '#000000',

  textPrimary: '#1A1A2E',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',

  border: '#E5E7EB',
  borderLight: '#F3F4F6',

  google: '#FFFFFF',
  apple: '#000000',

  error: '#EF4444',
  success: '#22C55E',

  overlay: 'rgba(0, 0, 0, 0.3)',
  transparent: 'transparent',
  surface: '#FFFFFF',
  surfaceLight: '#F9FAFB',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;


export const FontSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 28,
  xxl: 36,
  logo: 42,
} as const;


export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;


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
